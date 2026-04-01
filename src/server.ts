import fs from "node:fs/promises";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import z from "zod";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CreateMessageRequestSchema, CreateMessageResultSchema } from "@modelcontextprotocol/sdk/types.js";


const server = new McpServer({
  name: "test",
  version: "1.0"
}, {
  capabilities: {
    resources: {},
    tools: {},
    prompts: {}
  }
});

server.resource(
  "users",
  "users://", {
  description: "get all users",
  title: "Users",
  mimeType: "application/json",
}, async uri => {

  const users = await import("./data/users.json", {
    with: { type: "json" }
  }).then(m => m.default)

  return {
    contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(users) }]
  }
}
)

server.resource("user details", new ResourceTemplate("users://{userId}/profile", { list: undefined }),
  {
    description: "get a user detail from DB",
    title: "User details",
    mimeType: "application/json",
  }, async (uri, { userId }) => {
    const users = await import("./data/users.json", {
      with: { type: "json" }
    }).then(m => m.default)

    const user = users.find(user => user.id === parseInt(userId as string))

    if (user == null) {
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify({ error: "User not found" })
          }
        ]
      }
    }

    return {
      contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(user) }]
    }
  }
)

server.tool("create-user", "create a new user in the DB", {
  name: z.string(),
  email: z.string(),
  address: z.string(),
  phone: z.string(),
}, {
  title: "Create User",
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true
}, async (user) => {

  try {
    const id = await createUser(user)
    return {
      content: [{ type: "text", text: `user created with id ${id}` }]
    }
  } catch {
    return {
      content: [{ type: "text", text: "failed to create user" }]
    }
  }
})

server.prompt("generate-fake-user", "generate a fake user based on a given name", {
  name: z.string(),
}, ({ name }) => {
  return {
    messages: [{
      role: 'user',
      content:
        { type: "text", text: `generate a fake user based on a given name ${name}` }
    }]
  }
})

server.tool("create-random-user", "create a ramdom user in the DB", {
  name: z.string(),
}, {
  title: "Create Random User",
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true
}, async ({ name }) => {
  const res = await server.server.request({
    method: "sampling/createMessage",
    params: {
      messages: [
        {
          role: "user", content: {
            type: "text", text: "generate a fake user data, the data should have a realistic name, email, address, phone number, return this data as a json object with no other text or formatter so it can be used with json.parse"
          }
        }
      ], maxTokens: 1024
    }
  }, CreateMessageResultSchema
  )
  if (res.content.type !== "text") {
    return {
      content: [{ type: "text", text: "failed to generate a user data" }]
    }
  }

  try {
    const fakeUser = JSON.parse(res.content.text.trim().replace(/^```json/, "").replace(/```$/, "").trim())
    const id = await createUser(fakeUser)
    return {
      content: [{ type: "text", text: `user created with id ${id}` }]
    }
  } catch {
    return {
      content: [{ type: "text", text: "failed to create user" }]
    }
  }
})

async function createUser(user: {
  name: string;
  email: string;
  address: string;
  phone: string;
}) {
  const users = await import("./data/users.json", {
    with: { type: "json" }
  }).then(m => m.default)

  const id = users.length + 1
  users.push({ id, ...user })

  await fs.writeFile("./src/data/users.json", JSON.stringify(users, null, 2))
  return id;
}


async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main()





// import { Server } from "@modelcontextprotocol/sdk/server/index.js";
// import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// async function main() {
//   const server = new Server({
//     name: "example-server",
//     version: "1.0.0"
//   }, {
//     capabilities: {
//       resources: {},
//       tools: {},
//       prompts: {}
//     }
//   });

//   const transport = new StdioServerTransport();
//   await server.connect(transport);
//   console.error("MCP Server is running on stdio");
// }

// main().catch(console.error);
