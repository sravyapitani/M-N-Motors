import { useEffect, useState } from "react";
import "./AICopilot.css";

type Message = {
    role: "assistant" | "user";
    text: string;
};

const suggestedQuestions = [
    "Summarize this week's receivables position",
    "How many loan applications are pending disbursement?",
    "Any RC Book authenticity flags this week?",
    "What's today's HR headcount and attendance?",
    "Give me a one-paragraph management summary for today",
];

export default function AICopilot() {
    const [isOpen, setIsOpen] = useState(false);
    useEffect(() => {
        const openCopilot = () => setIsOpen(true);

        window.addEventListener("open-ai-copilot", openCopilot);

        return () => {
            window.removeEventListener("open-ai-copilot", openCopilot);
        };
    }, []);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(true);

    const sendMessage = (text: string) => {
        const question = text.trim();
        if (!question) return;

        setMessages((previous) => [
            ...previous,
            { role: "user", text: question },
        ]);
        setInput("");
        setShowSuggestions(false);
    };

    return (
        <>
            {isOpen && (
                <aside className="ai-copilot-panel">
                    <header className="ai-copilot-header">
                        <div className="ai-copilot-brand">
                            <div className="ai-copilot-logo">✦</div>
                            <div>
                                <strong>Nexus AI Copilot</strong>
                                <span>Answers computed live from your ERP data</span>
                            </div>
                        </div>

                        <button
                            className="ai-copilot-close"
                            type="button"
                            aria-label="Close AI Copilot"
                            onClick={() => setIsOpen(false)}
                        >
                            ×
                        </button>
                    </header>

                    <div className="ai-copilot-messages">
                        <div className="ai-copilot-welcome">
                            Hi Suresh! I'm the Nexus AI Copilot — ask me about
                            Finance &amp; Loan Desk, Accounts, HR &amp; Payroll or
                            Exchange/RC Book verification.
                        </div>

                        {showSuggestions && (
                            <div className="ai-copilot-suggestions">
                                {suggestedQuestions.map((question) => (
                                    <button
                                        type="button"
                                        key={question}
                                        onClick={() => sendMessage(question)}
                                    >
                                        {question}
                                    </button>
                                ))}
                            </div>
                        )}

                        {messages.map((message, index) => (
                            <div
                                key={`${index}-${message.role}`}
                                className={`ai-copilot-message ${message.role}`}
                            >
                                {message.text}
                            </div>
                        ))}
                    </div>

                    <form
                        className="ai-copilot-input-area"
                        onSubmit={(event) => {
                            event.preventDefault();
                            sendMessage(input);
                        }}
                    >
                        <input
                            value={input}
                            onChange={(event) => setInput(event.target.value)}
                            placeholder="Ask about receivables, payroll, loan apps, RC Book..."
                            aria-label="Ask Nexus AI Copilot"
                        />
                        <button type="submit" aria-label="Send message">
                            ➤
                        </button>
                    </form>
                </aside>
            )}

            <button
                className="floating-copilot"
                type="button"
                aria-label="Open AI Assistant"
                title="AI Assistant"
                onClick={() => setIsOpen((previous) => !previous)}
            >
                ✦
            </button>
        </>
    );
}
