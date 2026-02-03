export default function Contact() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Contact Us</h1>
        
        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Get in Touch</h2>
            <p>
              We're here to help! If you have questions, feedback, or need support with AutoDev.AI, please
              reach out to us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Support Email</h2>
            <p className="mb-2">For technical support and general inquiries:</p>
            <a 
              href="mailto:itsshaanram@gmail.com" 
              className="text-blue-600 hover:text-blue-800 font-semibold text-lg"
            >
              itsshaanram@gmail.com
            </a>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">What We Can Help With</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Technical issues or bugs</li>
              <li>Account and authentication problems</li>
              <li>Feature requests and suggestions</li>
              <li>Integration questions (Jira, Confluence, GitHub)</li>
              <li>Privacy and security concerns</li>
              <li>General questions about AutoDev.AI</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Response Time</h2>
            <p>
              We aim to respond to all inquiries within 24-48 hours during business days.
            </p>
          </section>

          <section className="mt-8 p-6 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Quick Links</h3>
            <div className="space-y-2">
              <a href="/privacy" className="block text-blue-600 hover:text-blue-800">
                → Privacy Policy
              </a>
              <a href="/terms" className="block text-blue-600 hover:text-blue-800">
                → Terms of Service
              </a>
              <a href="/" className="block text-blue-600 hover:text-blue-800">
                → Back to Dashboard
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
