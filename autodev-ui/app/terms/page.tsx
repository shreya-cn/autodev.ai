export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
        
        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Agreement to Terms</h2>
            <p>
              By accessing and using AutoDev.AI, you agree to be bound by these Terms of Service and all
              applicable laws and regulations.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Use License</h2>
            <p>
              Permission is granted to use AutoDev.AI for project management, documentation, and development
              workflow automation. This license shall automatically terminate if you violate any of these
              restrictions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Use the service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any systems or data</li>
              <li>Interfere with or disrupt the service</li>
              <li>Use the service to transmit malicious code</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">AI-Generated Content</h2>
            <p>
              AutoDev.AI uses AI to generate suggestions and analysis. While we strive for accuracy, AI-generated
              content should be reviewed and verified before use in production environments.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Disclaimer</h2>
            <p>
              The service is provided "as is" without warranty of any kind. We do not guarantee that the service
              will be uninterrupted, secure, or error-free.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Limitation of Liability</h2>
            <p>
              In no event shall AutoDev.AI be liable for any damages arising out of the use or inability to use
              the service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes to Terms</h2>
            <p>
              We reserve the right to modify these terms at any time. Continued use of the service after changes
              constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact Information</h2>
            <p>
              For questions about these Terms, please contact: <strong>itsshaanram@gmail.com</strong>
            </p>
          </section>

          <p className="text-sm text-gray-500 mt-8">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}
