import React from 'react';
import { Link } from 'react-router-dom';

import heroImage from '../assets/gngbg.png'; 

function About({ user }) {
  const HERO_IMAGE_URL = heroImage; 

  return (
    <div className="min-h-screen bg-white">
      
      <header 
        className="relative h-[60vh] md:h-[70vh] flex items-center justify-center bg-gray-900" 
        style={{
          backgroundImage: `url(${HERO_IMAGE_URL})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="absolute inset-0 bg-black/50 backdrop-brightness-75"></div>
        
        <div className="relative max-w-4xl mx-auto px-4 text-center z-10">
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-tight text-white tracking-tight drop-shadow-lg">
            Skip the Queue. <span className="text-orange-400">Grab N Go</span> Fast.
          </h1>
          <p className="mt-4 text-xl text-white/90 font-medium drop-shadow-md">
            Your campus canteen, redefined. Browse fresh daily specials, place your order online, and pick up when it's ready.
          </p>
          
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link 
              to={user ? "/menu" : "/register/customer"} 
              className="inline-flex items-center justify-center px-10 py-3 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-lg shadow-2xl shadow-orange-500/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-300 transition-all transform hover:scale-[1.02]"
            >
              Start Ordering Now
            </Link>
            
            {!user && (
              <Link 
                to="/login/customer" 
                className="inline-flex items-center justify-center px-10 py-3 rounded-full border-2 border-white/50 text-white font-semibold text-lg hover:border-orange-500 hover:text-orange-400 transition-all"
              >
                Log In
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="bg-gray-50 py-16 sm:py-20 lg:py-24">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 text-center">
            How Grab N Go Works
          </h2>
          
          <div className="mt-12 grid md:grid-cols-3 gap-8">
            
            <div className="p-8 rounded-2xl bg-white shadow-lg border-t-4 border-orange-500 hover:shadow-xl transition-shadow">
              <div className="text-4xl font-bold text-orange-600">1. Browse</div>
              <h3 className="mt-3 text-xl font-bold text-gray-900">Explore Today's Menu</h3>
              <p className="mt-2 text-gray-600">
                Check out the daily specials, filter by category, and see item availability in real-time.
              </p>
            </div>
            
            <div className="p-8 rounded-2xl bg-white shadow-lg border-t-4 border-orange-500 hover:shadow-xl transition-shadow">
              <div className="text-4xl font-bold text-orange-600">2. Order</div>
              <h3 className="mt-3 text-xl font-bold text-gray-900">Place Your Order Instantly</h3>
              <p className="mt-2 text-gray-600">
                Add items to your cart and complete checkout securely with your preferred payment method.
              </p>
            </div>
            
            <div className="p-8 rounded-2xl bg-white shadow-lg border-t-4 border-orange-500 hover:shadow-xl transition-shadow">
              <div className="text-4xl font-bold text-orange-600">3. Pick Up</div>
              <h3 className="mt-3 text-xl font-bold text-gray-900">Collect Your Meal</h3>
              <p className="mt-2 text-gray-600">
                Receive a notification when your order status changes to 'Ready' and skip the line to grab your food.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="py-12 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-lg font-medium text-gray-500">
            Ready to change the way you grab lunch?
          </p>
          <Link 
            to={user ? "/menu" : "/register/customer"} 
            className="mt-4 inline-flex items-center justify-center px-8 py-3 rounded-xl bg-orange-500 text-white font-bold text-xl hover:bg-orange-600 transition-colors"
          >
            Go to Menu
          </Link>
        </div>
      </div>
    </div>
  );
}

export default About;