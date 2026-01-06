import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";

// Initialize the OpenAI model with streaming enabled
const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.7,
  streaming: true,
});

// Define the state annotation for our graph
const GraphStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
    default: () => [],
  }),
});

type GraphState = typeof GraphStateAnnotation.State;

/**
 * Creates a LangGraph agent that processes chat messages
 * This uses LangGraph for orchestration but we'll stream directly from the model
 */
export function createChatGraph() {
  // Node: Process the user message and generate AI response
  async function processMessage(state: GraphState): Promise<Partial<GraphState>> {
    const { messages } = state;
    
    if (!messages || messages.length === 0) {
      throw new Error("No messages provided to process");
    }
    
    // Create a prompt template with system message and conversation history
    const promptMessages: Array<[string, string]> = [
      ["system", "You are a helpful AI assistant."],
    ];
    
    // Add conversation messages
    for (const msg of messages) {
      if (msg instanceof HumanMessage) {
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        if (content.trim()) {
          promptMessages.push(["human", content]);
        }
      } else if (msg instanceof AIMessage) {
        const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        if (content.trim()) {
          promptMessages.push(["assistant", content]);
        }
      }
    }

    if (promptMessages.length <= 1) {
      throw new Error("No valid conversation messages found");
    }

    const prompt = ChatPromptTemplate.fromMessages(promptMessages);

    // Create the chain
    const chain = prompt.pipe(model);
    
    // Generate response
    const response = await chain.invoke({});

    if (!response || !response.content) {
      throw new Error("Empty response from model");
    }

    return {
      messages: [response],
    };
  }

  // Build the graph
  const workflow = new StateGraph(GraphStateAnnotation)
    .addNode("process", processMessage)
    .addEdge(START, "process")
    .addEdge("process", END);

  return workflow.compile();
}

/**
 * Prepares messages for streaming using LangGraph orchestration
 * Returns the prompt chain ready for streaming
 */
export function prepareStreamingChain(messages: BaseMessage[]) {
  if (!messages || messages.length === 0) {
    throw new Error("No messages provided");
  }
  
  // Create a prompt template with system message and conversation history
  const promptMessages: Array<[string, string]> = [
    ["system", "You are a helpful AI assistant."],
  ];
  
  // Add conversation messages
  for (const msg of messages) {
    if (msg instanceof HumanMessage) {
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      if (content.trim()) {
        promptMessages.push(["human", content]);
      }
    } else if (msg instanceof AIMessage) {
      const content = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      if (content.trim()) {
        promptMessages.push(["assistant", content]);
      }
    }
  }

  if (promptMessages.length <= 1) {
    throw new Error("No valid conversation messages found");
  }

  const prompt = ChatPromptTemplate.fromMessages(promptMessages);
  
  // Create the chain ready for streaming
  return prompt.pipe(model);
}

/**
 * Converts UI messages format to LangChain messages
 */
export function convertToLangChainMessages(
  uiMessages: Array<{ role: string; content: string }>
): BaseMessage[] {
  return uiMessages
    .filter((msg) => msg && msg.role) // Filter out invalid messages
    .map((msg) => {
      const content = msg.content || "";
      const role = msg.role.toLowerCase();
      
      if (role === "user" || role === "human") {
        return new HumanMessage(content);
      } else if (role === "assistant" || role === "ai") {
        return new AIMessage(content);
      } else {
        // Default to human message for unknown roles
        console.warn(`Unknown role "${msg.role}", treating as human message`);
        return new HumanMessage(content);
      }
    });
}


