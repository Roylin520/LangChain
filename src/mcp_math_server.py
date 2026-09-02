"""MCP stdio server for Day 3 Lab.

先不要直接執行這個檔案；04_mcp_agent.py 會用 stdio 啟動它。
"""

from fastmcp import FastMCP

mcp = FastMCP("WorkshopMath")


@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two integers."""
    return a + b


@mcp.tool()
def multiply(a: int, b: int) -> int:
    """Multiply two integers."""
    return a * b


if __name__ == "__main__":
    mcp.run(transport="stdio")
