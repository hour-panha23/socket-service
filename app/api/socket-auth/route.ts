// app/api/socket-auth/route.ts

import { logger } from "@/src/lib/logger";
import { buildSignedAuth } from "@/src/lib/socket-auth";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    try {
        const { projectId, type } = await req.json();

        // Select the private secret safely on the server side
        const secret =
            type === "admin" ? process.env.ADMIN_SECRET : process.env.APP_SECRET;

        if (!secret) {
            return NextResponse.json(
                { error: "Secret configuration missing" },
                { status: 500 }
            );
        }

        const signed = await buildSignedAuth(projectId, secret);

        return NextResponse.json({
            timestamp: signed.timestamp,
            signature: signed.signature,
        });
    } catch (err) {
        logger.error(err)
        return NextResponse.json(
            { error: "Failed to generate auth signature" },
            { status: 500 }
        );
    }
}