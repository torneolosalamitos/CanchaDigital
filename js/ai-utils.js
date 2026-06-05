async function callClaude(prompt, maxTokens = 1500) {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `Error ${response.status}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.content[0].text;
}
