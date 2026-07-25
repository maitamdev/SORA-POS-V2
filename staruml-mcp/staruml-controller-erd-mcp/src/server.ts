import { createServer, erdTools } from "staruml-controller-mcp-core"

export function createErdServer() {
    return createServer("staruml-controller-erd", "1.0.0", erdTools)
}
