import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import path from "path"

// /mcp, MCP server discovery endpoint.
//
// Mintlify's Agent Score (and emerging MCP-discovery conventions) probe `/mcp`
// for a 200 response describing the server. Today we serve the same manifest
// hosted at /.well-known/mcp.json, which advertises the stdio-installed FastMCP
// server in src/mcp_server/chideals_mcp.py. A future remote HTTP-streamable
// endpoint will replace this stub when rate limiting / auth land.

export const dynamic = "force-static"
export const revalidate = 3600 // re-read manifest hourly during ISR

async function loadManifest() {
  const manifestPath = path.join(process.cwd(), "public", ".well-known", "mcp.json")
  const raw = await readFile(manifestPath, "utf-8")
  return JSON.parse(raw)
}

export async function GET() {
  try {
    const manifest = await loadManifest()
    return NextResponse.json(manifest, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "X-MCP-Discovery": "https://www.312deals.com/.well-known/mcp.json",
        "X-MCP-Transport": "stdio (remote http planned)",
      },
    })
  } catch (e) {
    return NextResponse.json(
      { error: "MCP manifest unavailable", details: String(e) },
      { status: 500 }
    )
  }
}

export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "X-MCP-Discovery": "https://www.312deals.com/.well-known/mcp.json",
    },
  })
}
