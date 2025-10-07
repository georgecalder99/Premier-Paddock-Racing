export default function EnvDebug() {
  return (
    <pre style={{padding:16}}>
      NEXT_PUBLIC_ADMIN_EMAILS = {process.env.NEXT_PUBLIC_ADMIN_EMAILS || "(not set)"}
    </pre>
  );
}