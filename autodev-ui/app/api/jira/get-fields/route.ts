import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(
      `${process.env.JIRA_URL}/rest/api/3/field`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.JIRA_USER}:${process.env.JIRA_API_TOKEN}`
          ).toString("base64")}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: error },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch Jira fields" },
      { status: 500 }
    );
  }
}
