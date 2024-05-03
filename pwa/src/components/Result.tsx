export default function Result({ result }: { result: string }) {
  return (
    <div className="container mx-auto p-4">
      {result.split('\n').map((item, i) => (
        <p key={i} className="mb-4">{item}</p>
      ))}
    </div>
  );
}
