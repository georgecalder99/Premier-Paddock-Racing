import Head from "next/head";

export default function Lock() {
  return (
    <>
      <Head><title>Enter passcode</title></Head>
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
        <form
          method="POST"
          action="/api/unlock"
          className="w-full max-w-sm bg-white p-6 rounded-xl shadow border"
        >
          <h1 className="text-xl font-semibold text-gray-900">Site locked</h1>
          <p className="text-sm text-gray-600 mt-1">
            Enter the passcode to continue.
          </p>

          <label className="block mt-4 text-sm">
            Passcode
            <input
              name="code"
              type="password"
              required
              className="mt-1 w-full border rounded px-3 py-2"
              autoFocus
            />
          </label>

          <button
            type="submit"
            className="mt-4 w-full bg-green-900 text-white rounded px-4 py-2"
          >
            Unlock
          </button>
        </form>
      </main>
    </>
  );
}