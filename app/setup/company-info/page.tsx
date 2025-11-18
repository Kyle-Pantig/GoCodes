export default function CompanyInfoPage() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center max-w-2xl mx-auto px-6">
        <h1 className="text-4xl font-bold mb-4">Coming Soon</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Company Info feature is under development
        </p>
        <div className="bg-muted/50 rounded-lg p-6 text-left space-y-4">
          <h2 className="text-xl font-semibold mb-3">What this feature will do:</h2>
          <p className="text-muted-foreground">
            This page will allow you to store and manage your company profile details, making them dynamic across the entire Asset Dog application. Every company using Asset Dog will be able to customize:
          </p>
          <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
            <li><strong>Company Name</strong> - Your organization's name</li>
            <li><strong>Contact Information</strong> - Phone, email, and other contact details</li>
            <li><strong>Address</strong> - Company address and location</li>
            <li><strong>Primary Logo</strong> - Main company logo used throughout the application</li>
            <li><strong>Secondary Logo</strong> - Alternative logo for specific use cases</li>
          </ul>
          <p className="text-sm text-muted-foreground mt-4 pt-4 border-t">
            These details will be dynamically displayed across forms, reports, PDFs, and other areas of the system, allowing each company to brand Asset Dog according to their organization.
          </p>
        </div>
      </div>
    </div>
  )
}

