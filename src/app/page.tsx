import Link from "next/link";

const features = [
  { title: "Speak, don't type forms", text: "Job posts, resumes, offers and acceptances are written by AI agents from your voice or text." },
  { title: "Trust scores", text: "Everyone starts at 100. Backing out of offers or leaving without notice costs 5 points." },
  { title: "One data lake", text: "Every resume, offer, acceptance and joining record is stored in one place." },
];

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-3xl text-center">
        <span className="inline-block rounded-full bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1 mb-4">
          AI-native recruiting for SMEs
        </span>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Hire by just <span className="text-indigo-600">saying it.</span>
        </h1>
        <p className="mt-4 text-lg text-gray-600">
          &ldquo;Find me a CA with 2 years at an SME in Mumbai who has worked in manufacturing.&rdquo; Done.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link href="/signup" className="rounded-lg bg-indigo-600 px-6 py-3 text-white font-semibold hover:bg-indigo-700">
            Get started
          </Link>
          <Link href="/login" className="rounded-lg border border-gray-300 bg-white px-6 py-3 font-semibold hover:bg-gray-50">
            Log in
          </Link>
        </div>
      </div>
      <div className="mt-16 grid gap-4 sm:grid-cols-3 max-w-4xl w-full">
        {features.map((f) => (
          <div key={f.title} className="rounded-xl bg-white border border-gray-200 p-5">
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-gray-600">{f.text}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
