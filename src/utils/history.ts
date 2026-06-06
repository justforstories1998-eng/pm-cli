export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
  timestamp?: Date;
  attachments?: AttachmentInfo[];
}

export interface AttachmentInfo {
  type: "image" | "file";
  name: string;
  mimeType: string;
  size: number;
}

export class ConversationHistory {
  private messages: Message[] = [];
  private systemPrompt: string;
  private maxSize: number;

  constructor(systemPrompt: string, maxSize: number = 20) {
    this.systemPrompt = systemPrompt;
    this.maxSize = maxSize;
  }

  addMessage(
    role: "user" | "assistant",
    content: string,
    attachments?: AttachmentInfo[]
  ): void {
    this.messages.push({
      role,
      content,
      timestamp: new Date(),
      attachments,
    });
    if (this.messages.length > this.maxSize) {
      this.messages = this.messages.slice(this.messages.length - this.maxSize);
    }
  }

  getMessages(): Array<{ role: string; content: string }> {
    const systemMsg: { role: string; content: string } = {
      role: "system",
      content: this.systemPrompt,
    };
    return [
      systemMsg,
      ...this.messages.map((m) => ({ role: m.role, content: m.content })),
    ];
  }

  getLastAssistantMessage(): string | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === "assistant") {
        return this.messages[i].content;
      }
    }
    return null;
  }

  getLastUserMessage(): string | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].role === "user") {
        return this.messages[i].content;
      }
    }
    return null;
  }

  clear(): void {
    this.messages = [];
  }

  updateSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
  }

  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  getStats(): { messageCount: number; estimatedTokens: number } {
    const totalChars =
      this.messages.reduce((sum, m) => sum + m.content.length, 0) +
      this.systemPrompt.length;
    return {
      messageCount: this.messages.length,
      estimatedTokens: Math.ceil(totalChars / 4),
    };
  }

  toText(): string {
    const lines: string[] = [];
    lines.push(`SYSTEM: ${this.systemPrompt}`);
    lines.push("─".repeat(60));
    for (const msg of this.messages) {
      const ts = msg.timestamp
        ? msg.timestamp.toLocaleTimeString("en-US", { hour12: false })
        : "00:00:00";
      lines.push(`[${ts}] ${msg.role.toUpperCase()}: ${msg.content}`);
      if (msg.attachments && msg.attachments.length > 0) {
        for (const att of msg.attachments) {
          lines.push(
            `  [ATTACHMENT: ${att.name} (${att.type}, ${att.mimeType})]`
          );
        }
      }
    }
    return lines.join("\n");
  }
}