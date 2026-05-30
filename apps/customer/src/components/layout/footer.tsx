import Link from "next/link";
import { Phone, Mail, MapPin, Facebook, Twitter, Instagram, Linkedin } from "lucide-react";

export function Footer() {
  return (
    <footer>
      {/* Newsletter bar */}
      <div className="bg-slate-800 border-t border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-white">Subscribe to Our Newsletter</p>
            <p className="text-slate-400 text-sm">Get the latest deals, new arrivals and industry news.</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <input
              type="email"
              placeholder="Enter your email address"
              className="flex-1 sm:w-64 h-10 px-4 text-sm bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              type="button"
              className="h-10 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
            >
              Subscribe
            </button>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="bg-slate-900 text-slate-300">
        <div className="max-w-7xl mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-baseline gap-0.5 mb-3">
              <span className="text-xl font-black text-white">Avenick</span>
              <span className="text-xl font-black text-green-500">.</span>
            </div>
            <p className="text-slate-400 text-sm mb-5 leading-relaxed max-w-xs">
              B2B-first. B2C-ready. Built for modern trade. GCC&apos;s trusted marketplace for industrial supplies and B2B procurement.
            </p>
            <div className="space-y-2 text-sm">
              <p className="flex items-center gap-2 text-slate-400">
                <Phone className="h-3.5 w-3.5 text-green-500 shrink-0" /> +971 4 234 5678
              </p>
              <p className="flex items-center gap-2 text-slate-400">
                <Mail className="h-3.5 w-3.5 text-green-500 shrink-0" /> info@avenick.com
              </p>
              <p className="flex items-center gap-2 text-slate-400">
                <MapPin className="h-3.5 w-3.5 text-green-500 shrink-0" /> Dubai, United Arab Emirates
              </p>
            </div>
          </div>

          {/* Customer Service */}
          <div>
            <h3 className="font-semibold text-white mb-4">Customer Service</h3>
            <ul className="space-y-2.5">
              {[
                ["Help Center", "#"],
                ["Track Order", "#"],
                ["Returns Policy", "#"],
                ["Shipping Info", "#"],
                ["Contact Us", "/support"],
              ].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-slate-400 hover:text-green-400 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* About Us */}
          <div>
            <h3 className="font-semibold text-white mb-4">About Us</h3>
            <ul className="space-y-2.5">
              {[
                ["About Avenick", "#"],
                ["Sell on Avenick", "#"],
                ["Careers", "#"],
                ["Press", "#"],
                ["Become a Partner", "#"],
              ].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-slate-400 hover:text-green-400 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-semibold text-white mb-4">Resources</h3>
            <ul className="space-y-2.5">
              {[
                ["B2B Catalog", "#"],
                ["RFQ Guide", "/b2b/rfq/new"],
                ["Supplier Portal", "#"],
                ["Compliance", "#"],
                ["API Docs", "#"],
              ].map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-sm text-slate-400 hover:text-green-400 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-slate-800 px-4 py-4">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              © 2024 Avenick Commerce. All rights reserved. Powered by Kodekinetics.
            </p>
            <div className="flex gap-4 text-xs text-slate-500">
              <Link href="#" className="hover:text-slate-300">Privacy Policy</Link>
              <Link href="#" className="hover:text-slate-300">Terms of Service</Link>
              <Link href="#" className="hover:text-slate-300">Cookie Policy</Link>
            </div>
            <div className="flex gap-3">
              {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                <Link
                  key={i}
                  href="#"
                  aria-label="Social media"
                  className="h-7 w-7 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-green-600 transition-colors group"
                >
                  <Icon className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
