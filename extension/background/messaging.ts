export type MessageAction =
  | "START_AUTOMATION"
  | "PAUSE_AUTOMATION"
  | "RESUME_AUTOMATION"
  | "STOP_AUTOMATION"
  | "GET_STATUS"
  | "LOG_EVENT"

export interface Message {
  action: MessageAction
  platform?: string
  data?: any
}

export const sendMessage = (msg: Message): Promise<any> => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(msg, resolve)
  })
}

export const onMessage = (
  handler: (msg: Message, sender: chrome.runtime.MessageSender) => any
) => {
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    const result = handler(msg, sender)
    if (result instanceof Promise) {
      result.then(sendResponse)
    } else {
      sendResponse(result)
    }
    return true
  })
}
