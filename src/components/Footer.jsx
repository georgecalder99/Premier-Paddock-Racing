import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-green-900 text-gray-100 mt-16">
      <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-8">
        <div>
          <h3 className="text-xl font-bold">Premier Paddock Racing</h3>
          <p className="mt-3 text-sm text-gray-300">
            Affordable and transparent racehorse ownership. Join our community and enjoy the thrill of racing.
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            <li><Link href="/horses" className="hover:underline">Horses</Link></li>
            <li><Link href="/how-it-works" className="hover:underline">How it Works</Link></li>
            <li><Link href="/faqs" className="hover:underline">FAQs</Link></li>
            <li><Link href="/contact" className="hover:underline">Contact Us</Link></li>
            <li><Link href="/my-paddock" className="hover:underline">My Paddock</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Important Info</h4>
          <p className="text-xs text-gray-300">
            Racehorse ownership is a leisure activity and not an investment.
            Prize money and returns are not guaranteed. Please read the terms before joining.
          </p>
        </div>
      </div>

      <div className="border-t border-green-800 text-center py-4 text-xs text-gray-400">
        © {new Date().getFullYear()} Premier Paddock Racing. All rights reserved.
      </div>
    </footer>
  );
}
