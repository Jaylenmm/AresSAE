export default function DisclaimerPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Legal Disclaimer</h1>
        
        <div className="space-y-6 text-gray-300">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">Ares Sports Analysis Disclaimer</h2>
            <p>
              Ares is an independent sports analytics and information platform. We are not a sportsbook, 
              gambling operator, or betting service of any kind. Our platform provides statistical analysis, 
              data insights, and educational content for entertainment and informational purposes only.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">Not Gambling Services</h2>
            <p>
              Ares does not accept wagers, facilitate betting, or provide gambling services. We do not offer 
              odds for sports gaming. Any analysis or information provided is for educational purposes only 
              and should not be construed as gambling advice or a recommendation to place bets.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">Age Restriction</h2>
            <p>
              Our services are intended for users 21 years of age or older (18+ where legally permitted).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">User Responsibility</h2>
            <p>
              It is your sole responsibility to know and comply with all applicable local, state, and federal 
              laws regarding sports betting and gambling in your jurisdiction before engaging in any betting 
              activities. Laws vary by location.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">No Guarantees</h2>
            <p>
              While we strive for accuracy, we make no guarantees regarding the accuracy, completeness, or 
              timeliness of any information, analysis, or data provided. We are not responsible for any 
              decisions made based on information from our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">Gambling Responsibly</h2>
            <p className="mb-3">
              If you choose to engage in sports betting, please do so responsibly. Gambling involves risk 
              and you may lose money. If you or someone you know has a gambling problem, help is available:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>National Problem Gambling Helpline: <strong>1-800-GAMBLER</strong></li>
              <li>
                Visit:{' '}
                <a 
                  href="https://www.ncpgambling.org/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 underline"
                >
                  www.ncpgambling.org
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">Third-Party Links</h2>
            <p>
              Our platform may contain links to third-party sportsbooks or betting operators. We are not 
              responsible for the content, services, or practices of any third-party websites.
            </p>
          </section>

          <section className="pt-6 border-t border-gray-800">
            <p className="text-sm text-gray-500">
              Last Updated: October 24, 2025
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
