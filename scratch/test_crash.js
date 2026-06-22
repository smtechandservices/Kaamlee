try {
  const job = { job_url: undefined, site: 'linkedin' };
  const urlMatch = job.job_url?.toLowerCase().includes('linkedin');
  console.log('urlMatch:', urlMatch);
} catch (e) {
  console.log('Error:', e.message);
}
