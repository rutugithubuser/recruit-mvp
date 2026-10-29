// Candidate uploads a resume file (from laptop or phone). The Resume Agent reads it.
import { getAuthContext } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { buildResume } from "@/lib/agents/resume";
import { logAgent } from "@/lib/agents/log";

export const maxDuration = 60;

const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "text/plain": "txt",
};

export async function POST(req: Request) {
  const ctx = await getAuthContext(req);
  if (!ctx) return Response.json({ error: "Please log in again." }, { status: 401 });
  if (ctx.profile.role !== "candidate") return Response.json({ error: "Only candidates can upload resumes." }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  const message = String(form.get("message") ?? "Here is my resume");
  if (!(file instanceof File)) return Response.json({ error: "No file received." }, { status: 400 });
  if (!ALLOWED[file.type]) {
    return Response.json({ error: "Please upload a PDF, image (JPG/PNG) or text file. For Word files, save as PDF first." }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) return Response.json({ error: "File is too large (max 5 MB)." }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const path = `${ctx.userId}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error: upErr } = await supabaseAdmin.storage.from("resumes").upload(path, bytes, { contentType: file.type });
  if (upErr) return Response.json({ error: "Upload failed: " + upErr.message }, { status: 500 });

  try {
    const result = await buildResume({
      ctx, message, history: [], source: "upload",
      file: { mimeType: file.type, base64: bytes.toString("base64"), path, name: file.name },
    });
    await logAgent("resume", ctx.userId, { message, file: file.name }, { reply: result.reply });
    return Response.json(result);
  } catch (e) {
    console.error(e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
