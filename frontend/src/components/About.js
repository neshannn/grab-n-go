
import React from 'react';
import { Link } from 'react-router-dom';

function About({ user }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-orange-50">
      <header className="max-w-6xl mx-auto px-4 pt-16 pb-8">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight text-gray-500">
              Fast, Fresh, & Convenient Canteen Ordering.
            </h1>
            <p className="mt-4 text-lg text-gray-600">
              Skip the queue. Discover curated menus, add to cart, and place orders in seconds. Like your favorite delivery apps but built for your campus canteen.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={user ? "/menu" : "/register/customer"} className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-300 transition-all">
                Get Started
              </Link>
              {!user && (
                <Link to="/login/customer" className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-primary-200 text-primary-700 hover:bg-primary-50 font-semibold focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary-200 transition-all">
                  Sign In
                </Link>
              )}
            </div>
            <div className="mt-8 flex items-center gap-6 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <span className="text-primary-600">★</span>
                Trusted by students and staff
              </div>
              <div className="flex items-center gap-2">
                <span className="text-primary-600">⚡</span>
                Under-a-minute checkout
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl bg-gradient-to-tr from-primary-100 to-orange-100 shadow-inner flex items-center justify-center text-7xl">
              🍔
            </div>
          </div>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-4 py-10">
        <h2 className="text-2xl font-bold text-gray-900">How it works</h2>
        <div className="mt-6 grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl bg-white shadow">
            <div className="text-3xl">🔎</div>
            <h3 className="mt-3 font-semibold">Browse menu</h3>
            <p className="mt-2 text-gray-600">Explore categories, search items, and see availability in real time.</p>
          </div>
          <div className="p-6 rounded-xl bg-white shadow">
            <div className="text-3xl">🛒</div>
            <h3 className="mt-3 font-semibold">Add to cart</h3>
            <p className="mt-2 text-gray-600">Customize quantities and review pricing before checkout.</p>
          </div>
          <div className="p-6 rounded-xl bg-white shadow">
            <div className="text-3xl">✅</div>
            <h3 className="mt-3 font-semibold">Place order</h3>
            <p className="mt-2 text-gray-600">Pay your way and track order status until it’s ready.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default About;


