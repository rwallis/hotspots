import { NextResponse } from "next/server";
import { importUploadedIgcFile } from "@/lib/sync/service";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "IGC file is required" }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".igc")) {
      return NextResponse.json(
        { error: "Only .igc files are supported" },
        { status: 400 },
      );
    }

    const igcContent = await file.text();
    if (igcContent.length < 100) {
      return NextResponse.json({ error: "IGC file is too small" }, { status: 400 });
    }

    const result = await importUploadedIgcFile({
      fileName: file.name,
      igcContent,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    const status = message.startsWith("Invalid IGC:") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
