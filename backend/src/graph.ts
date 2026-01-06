import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, END, START, Annotation } from "@langchain/langgraph";
import { HumanMessage, AIMessage, BaseMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";

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
 */
export function createChatGraph() {
  // Initialize the OpenAI model with streaming enabled
  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0.7,
    streaming: true,
  });

  // Node: Process the user message and generate AI response
  async function processMessage(state: GraphState): Promise<Partial<GraphState>> {
    const { messages } = state;
    
    // Create a prompt template with system message and conversation history
    const promptMessages: Array<[string, string]> = [
      ["system", "You are a helpful AI assistant."],
    ];
    
    // Add conversation messages
    for (const msg of messages) {
      if (msg instanceof HumanMessage) {
        promptMessages.push(["human", typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)]);
      } else if (msg instanceof AIMessage) {
        promptMessages.push(["assistant", typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content)]);
      }
    }

    const prompt = ChatPromptTemplate.fromMessages(promptMessages);

    // Create the chain
    const chain = prompt.pipe(model);
    
    // Generate response
    const response = await chain.invoke({});

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
 * Converts UI messages format to LangChain messages
 */
export function convertToLangChainMessages(
  uiMessages: Array<{ role: string; content: string }>
): BaseMessage[] {
  return uiMessages.map((msg) => {
    if (msg.role === "user") {
      return new HumanMessage(msg.content);
    } else if (msg.role === "assistant") {
      return new AIMessage(msg.content);
    }
    return new HumanMessage(String(msg.content));
  });
}


