import Header from '#/components/Header';
import Upload from '#/components/Upload';
import Footer from '#/components/Footer';

export default function Homepage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main>
        <Upload />
      </main>
      <Footer />
    </div>
  );
}
