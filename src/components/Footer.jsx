import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-green-900 text-gray-100 mt-16">
      <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-3 gap-8">
        {/* Brand */}
        <div>
          <h3 className="text-xl font-bold">Premier Paddock Racing</h3>
          <p className="mt-3 text-sm text-gray-300">
            Affordable and transparent racehorse ownership. Join our community
            and enjoy the thrill of racing.
          </p>
        </div>

        {/* Quick Links */}
        <div>
          <h4 className="font-semibold mb-3">Quick Links</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/horses" className="hover:underline">
                Horses
              </Link>
            </li>
            <li>
              <Link href="/how-it-works" className="hover:underline">
                How it Works
              </Link>
            </li>
            <li>
              <Link href="/faqs" className="hover:underline">
                FAQs
              </Link>
            </li>
            <li>
              <Link href="/contact-us" className="hover:underline">
                Contact Us
              </Link>
            </li>
            <li>
  <Link href="/register-interest" className="hover:underline">
    Register your interest
  </Link>
</li>
            <li>
              <Link href="/my-paddock" className="hover:underline">
                My Paddock
              </Link>
            </li>
          </ul>
        </div>

        {/* Legal Section */}
        <div>
          <h4 className="font-semibold mb-3">Important Info</h4>
          <p className="text-xs text-gray-300 mb-3">
            Racehorse ownership is a leisure activity and not an investment.
            Prize money and returns are not guaranteed. Please read the terms
            before joining.
          </p>

          <ul className="space-y-1 text-xs">
            <li>
              <Link href="/terms-and-conditions" className="hover:underline">
                Terms & Conditions
              </Link>
            </li>
            <li>
              <Link href="/privacy-policy" className="hover:underline">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/cookie-policy" className="hover:underline">
                Cookie Policy
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-green-800 text-center py-4 text-xs text-gray-400">
        © {new Date().getFullYear()} Premier Paddock Racing. All rights reserved.
      </div>
    </footer>
  );
}