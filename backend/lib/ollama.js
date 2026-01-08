export const generateAIContent = async (prompt) => {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434/api/generate";

    try {
        const response = await fetch(ollamaUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: "llama3",
                prompt: prompt,
                stream: false,
                options: {
                    temperature: 0.4,
                    top_p: 0.9,
                    repeat_penalty: 1.1
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.statusText}`);
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        if (error.cause?.code === 'ECONNREFUSED' || error.message.includes('connect')) {
            console.warn("Ollama service not detected on port 11434. Returning mock response for verification.");
            return `[AI SIMULATION]
This is a simulated response because Ollama (LLaMA 3) is currently offline. 
Once you start Ollama, this will be replaced with real AI-processed content.

Action: ${prompt.match(/USER ACTION:\s*(\w+)/)?.[1] || "Process"}
Content snippet: ${prompt.split('DOCUMENT CONTENT:')[1]?.trim().substring(0, 100)}...`;
        }
        console.error("Failed to generate content via Ollama:", error);
        throw error;
    }
};
