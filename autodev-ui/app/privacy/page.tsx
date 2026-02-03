export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
        
        <div className="space-y-6 text-gray-700">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Introduction</h2>
            <p>
              AutoDev.AI is committed to protecting your privacy. This policy explains how we handle your data
              when you use our application.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Collection</h2>
            <p>We collect and process the following data:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Your Atlassian account information (name, email, avatar)</li>
              <li>Jira tickets and issues you have access to</li>
              <li>Confluence pages and documentation you have access to</li>
              <li>GitHub pull request information (if configured)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Usage</h2>
            <p>Your data is used to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Display your assigned tickets and project information</li>
              <li>Generate AI-powered suggestions for ticket assignments</li>
              <li>Provide documentation and code analysis</li>
              <li>Enable automated PR reviews</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Storage</h2>
            <p>
              We do not store your personal data beyond your active session. All data is fetched in real-time
              from Atlassian APIs and is not permanently stored in our systems.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Data Security</h2>
            <p>
              We use industry-standard security measures to protect your data. All API communications are
              encrypted using HTTPS, and OAuth tokens are securely managed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Third-Party Services</h2>
            <p>We integrate with:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Atlassian (Jira and Confluence)</li>
              <li>OpenAI (for AI-powered features)</li>
              <li>GitHub (for PR reviews, if configured)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Access your data</li>
              <li>Revoke application access at any time</li>
              <li>Request data deletion</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact</h2>
            <p>
              For privacy concerns or questions, please contact us at: <strong>itsshaanram@gmail.com</strong>
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
