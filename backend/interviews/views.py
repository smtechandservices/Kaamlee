import logging

from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import views, permissions
from rest_framework.response import Response

from api.permissions import IsSubscribed
from .constants import ROUND_CONFIG, ROUND_BY_NAME, MAX_PROCTORING_EVENTS
from .models import InterviewSession, InterviewTurn
from .serializers import InterviewSessionSerializer
from . import groq_service

logger = logging.getLogger(__name__)


def _serialize_question(turn):
    round_cfg = ROUND_BY_NAME[turn.round]
    return {
        "id": turn.id,
        "round": turn.round,
        "roundLabel": round_cfg["label"],
        "questionType": turn.question_type,
        "question": turn.question,
        "options": turn.options,
        "timeLimitSeconds": round_cfg["time_limit"],
        "indexInRound": turn.index_in_round,
        "roundCount": round_cfg["count"],
    }


def _build_transcript(session):
    return [
        {
            "round": t.round,
            "question": t.question,
            "answer": t.user_answer,
            "isCorrect": t.is_correct,
            "score": t.ai_score,
            "feedback": t.ai_feedback,
        }
        for t in session.turns.filter(answered_at__isnull=False).order_by("created_at")
    ]


def _create_turn(session, round_name, index_in_round, target_role, precomputed=None):
    round_cfg = ROUND_BY_NAME[round_name]

    if precomputed is not None:
        return InterviewTurn.objects.create(
            session=session, round=round_name, index_in_round=index_in_round,
            question=precomputed.get("question", ""), question_type="open",
        )

    asked_so_far = list(session.turns.filter(round=round_name).values_list("question", flat=True))

    if round_cfg["type"] == "mcq":
        data = groq_service.generate_mcq_question(round_name, round_cfg["label"], target_role, asked_so_far)
        return InterviewTurn.objects.create(
            session=session, round=round_name, index_in_round=index_in_round,
            question=data["question"], question_type="mcq", options=data["options"],
            correct_index=data["correct_index"], ai_feedback=data.get("explanation", ""),
        )

    if round_name == "coding":
        data = groq_service.generate_coding_problem(target_role, asked_so_far)
        question_text = (
            f"{data['title']}\n\n{data['statement']}\n\n"
            f"Example:\nInput: {data['example_input']}\nOutput: {data['example_output']}"
        )
        return InterviewTurn.objects.create(
            session=session, round=round_name, index_in_round=index_in_round,
            question=question_text, question_type="open", meta=data,
        )

    # hr — first question of the round, no prior answer yet
    is_final = round_cfg["count"] == 1
    data = groq_service.generate_hr_turn(target_role, [], "", is_final)
    return InterviewTurn.objects.create(
        session=session, round=round_name, index_in_round=index_in_round,
        question=data.get("next_question", ""), question_type="open",
    )


class InterviewSessionListCreateView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def get(self, request):
        sessions = InterviewSession.objects.filter(user=request.user)
        return Response(InterviewSessionSerializer(sessions, many=True).data)

    def post(self, request):
        target_role = (request.data.get("target_role") or "Software Engineer").strip()[:200]
        session = InterviewSession.objects.create(
            user=request.user, target_role=target_role, round_plan=ROUND_CONFIG,
        )
        first_turn = _create_turn(session, ROUND_CONFIG[0]["round"], 0, target_role)
        return Response(
            {
                "session": InterviewSessionSerializer(session).data,
                "currentQuestion": _serialize_question(first_turn),
            },
            status=201,
        )


class InterviewSessionDetailView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def get(self, request, session_id):
        session = get_object_or_404(InterviewSession, id=session_id, user=request.user)
        current_turn = session.turns.filter(answered_at__isnull=True).order_by("created_at").first()
        return Response(
            {
                "session": InterviewSessionSerializer(session).data,
                "currentQuestion": _serialize_question(current_turn) if current_turn else None,
            }
        )


class InterviewAnswerView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def post(self, request, session_id):
        session = get_object_or_404(InterviewSession, id=session_id, user=request.user)
        if session.status != "in_progress":
            return Response({"error": "This interview has already finished."}, status=400)

        current_turn = session.turns.filter(answered_at__isnull=True).order_by("created_at").first()
        if not current_turn:
            return Response({"error": "No pending question for this session."}, status=400)

        answer_text = str(request.data.get("answer", "")).strip()
        round_cfg = ROUND_BY_NAME[current_turn.round]
        next_question_data = None

        if current_turn.question_type == "mcq":
            try:
                selected_index = int(answer_text)
            except (TypeError, ValueError):
                selected_index = -1
            current_turn.user_answer = answer_text
            current_turn.is_correct = selected_index == current_turn.correct_index
            current_turn.answered_at = timezone.now()
            current_turn.save()
            turn_result = {
                "isCorrect": current_turn.is_correct,
                "correctIndex": current_turn.correct_index,
                "feedback": current_turn.ai_feedback,
            }

        elif current_turn.round == "coding":
            eval_data = groq_service.evaluate_coding_answer(current_turn.meta or {}, answer_text)
            current_turn.user_answer = answer_text
            current_turn.is_correct = bool(eval_data.get("is_correct"))
            current_turn.ai_score = eval_data.get("score")
            current_turn.ai_feedback = eval_data.get("feedback", "")
            current_turn.answered_at = timezone.now()
            current_turn.save()
            turn_result = {
                "score": current_turn.ai_score,
                "isCorrect": current_turn.is_correct,
                "feedback": current_turn.ai_feedback,
            }

        else:  # hr
            history = [
                {"question": t.question, "answer": t.user_answer}
                for t in session.turns.filter(round="hr", answered_at__isnull=False).order_by("created_at")
            ]
            is_last_in_round = current_turn.index_in_round == round_cfg["count"] - 1
            hr_data = groq_service.generate_hr_turn(session.target_role, history, answer_text, is_last_in_round)
            current_turn.user_answer = answer_text
            current_turn.ai_score = hr_data.get("score")
            current_turn.ai_feedback = hr_data.get("feedback", "")
            current_turn.answered_at = timezone.now()
            current_turn.save()
            turn_result = {"score": current_turn.ai_score, "feedback": current_turn.ai_feedback}
            if not is_last_in_round:
                next_question_data = {"question": hr_data.get("next_question", "")}

        response_payload = {"turnResult": turn_result}
        round_complete = current_turn.index_in_round == round_cfg["count"] - 1

        if not round_complete:
            next_index = current_turn.index_in_round + 1
            precomputed = next_question_data if current_turn.round == "hr" else None
            next_turn = _create_turn(session, current_turn.round, next_index, session.target_role, precomputed=precomputed)
            session.current_question_index = next_index
            session.save()
            response_payload.update(
                {"nextQuestion": _serialize_question(next_turn), "roundComplete": False, "sessionComplete": False}
            )
        else:
            next_round_index = session.current_round_index + 1
            if next_round_index >= len(session.round_plan):
                transcript = _build_transcript(session)
                report = groq_service.generate_final_report(session.target_role, transcript)
                session.final_report = report
                session.overall_score = report.get("overall_score")
                session.status = "completed"
                session.completed_at = timezone.now()
                session.save()
                response_payload.update({"roundComplete": True, "sessionComplete": True, "report": report})
            else:
                session.current_round_index = next_round_index
                session.current_question_index = 0
                session.save()
                new_round_name = session.round_plan[next_round_index]["round"]
                next_turn = _create_turn(session, new_round_name, 0, session.target_role)
                response_payload.update(
                    {
                        "roundComplete": True,
                        "sessionComplete": False,
                        "newRound": new_round_name,
                        "nextQuestion": _serialize_question(next_turn),
                    }
                )

        return Response(response_payload)


class InterviewProctoringEventView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def post(self, request, session_id):
        session = get_object_or_404(InterviewSession, id=session_id, user=request.user)
        event_type = str(request.data.get("type", "unknown"))[:50]
        flags = session.proctoring_flags or []
        flags.append({"type": event_type, "at": timezone.now().isoformat()})
        session.proctoring_flags = flags[-MAX_PROCTORING_EVENTS:]
        session.save(update_fields=["proctoring_flags"])
        return Response({"violationCount": len(session.proctoring_flags)})


class InterviewReportView(views.APIView):
    permission_classes = [permissions.IsAuthenticated, IsSubscribed]

    def get(self, request, session_id):
        session = get_object_or_404(InterviewSession, id=session_id, user=request.user)
        if session.status != "completed":
            return Response({"error": "This interview is not finished yet."}, status=400)
        return Response(
            {
                "session": InterviewSessionSerializer(session).data,
                "report": session.final_report,
                "transcript": _build_transcript(session),
                "proctoringFlags": session.proctoring_flags,
            }
        )
