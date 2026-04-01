import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { select, input } from "@inquirer/prompts";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";


const mcp = new Client(
  {
    name: "client",
    version: "1.0"
  },
  { capabilities: { sampling: {} } }

)

const transport = new StdioClientTransport(
  {
    command: "node",
    args: ["build/server.js"],
    stderr: "ignore"
  }
)

async function main() {
  await mcp.connect(transport)

  const [{ tools }, { prompts }, { resources }, { resourceTemplates }] = await Promise.all([
    mcp.listTools(),
    mcp.listPrompts(),
    mcp.listResources(),
    mcp.listResourceTemplates()
  ])

  console.log("you are connected");
  while (true) {
    const option = await select({
      message: "what would you like to do",
      choices: ["Tools", "Prompts", "Resources", "Query"]
    })
    switch (option) {
      case "Tools":
        const toolName = await select({
          message: "Select a tool",
          choices: tools.map(tool => ({
            name: tool.annotations?.title || tool.name,
            value: tool.name,
            description: tool.description ?? ""
          }))
        })
        console.log(toolName);
        const tool = tools.find(t => t.name === toolName)
        if (tool == null) {
          console.error("tool not found")
        } else {
          await handleTool(tool)
        }
        break
    }
  }

}

async function handleTool(tool: Tool) {
  const args: Record<string, string> = {}
  for (const [key, value] of Object.entries(tool.inputSchema.properties ?? {})) {
    args[key] = await input({
      message: `Enter value for ${key} (${(value as { type: string }).type})`,
    })
  }
  const res = await mcp.callTool({
    name: tool.name,
    arguments: args,
  })

  console.log((res.content as [{ text: string }])[0].text)
}


main()