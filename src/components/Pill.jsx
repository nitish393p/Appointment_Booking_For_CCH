export default function Pill({ text, color }) {
  return <span className="pill" style={{ background: color || "#94a3b8" }}>{text}</span>;
}
