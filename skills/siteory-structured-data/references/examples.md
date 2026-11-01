# JSON-LD examples that pass the Siteory schema checks

Minimal, valid examples for each checked type. Replace every value with data the page actually shows; `https://www.example.com` stands for the production origin. Each block goes in `<script type="application/ld+json">`; frameworks.md shows how to render it.

## Homepage identity: Organization and WebSite

Clears `schema_home_identity` and the Organization rules. The `@id` values let other pages refer to the same organization.

```json
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.example.com/#organization",
      "name": "Acme",
      "url": "https://www.example.com/",
      "logo": "https://www.example.com/logo.png",
      "sameAs": ["https://www.linkedin.com/company/acme", "https://github.com/acme"]
    },
    {
      "@type": "WebSite",
      "@id": "https://www.example.com/#website",
      "name": "Acme",
      "url": "https://www.example.com/",
      "publisher": { "@id": "https://www.example.com/#organization" }
    }
  ]
}
```

## Product with Offer, AggregateRating and Review

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Acme Standing Desk",
  "image": ["https://www.example.com/images/desk-1200.jpg"],
  "description": "Electric standing desk, 120 x 70 cm, with memory presets.",
  "sku": "DESK-120",
  "brand": { "@type": "Brand", "name": "Acme" },
  "offers": {
    "@type": "Offer",
    "url": "https://www.example.com/products/standing-desk",
    "price": "499.00",
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock"
  },
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.6", "reviewCount": "128" },
  "review": [
    {
      "@type": "Review",
      "reviewRating": { "@type": "Rating", "ratingValue": "5", "bestRating": "5" },
      "author": { "@type": "Person", "name": "Dana Smith" },
      "reviewBody": "Quiet motor and very stable at full height."
    }
  ]
}
```

Only include `aggregateRating` and `review` when the page shows those reviews.

## BreadcrumbList

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Docs", "item": "https://www.example.com/docs" },
    { "@type": "ListItem", "position": 2, "name": "Installation", "item": "https://www.example.com/docs/install" },
    { "@type": "ListItem", "position": 3, "name": "Windows" }
  ]
}
```

## Article or BlogPosting

```json
{
  "@context": "https://schema.org",
  "@type": "BlogPosting",
  "headline": "How we cut invoice processing time in half",
  "image": ["https://www.example.com/blog/invoices/cover-1200.jpg"],
  "datePublished": "2026-03-14T09:30:00+01:00",
  "dateModified": "2026-04-02T11:00:00+01:00",
  "author": [{ "@type": "Person", "name": "Dana Smith", "url": "https://www.example.com/team/dana" }],
  "publisher": { "@id": "https://www.example.com/#organization" }
}
```

## Event

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "Invoicing Workshop for Agencies",
  "startDate": "2026-12-03T18:00:00+01:00",
  "endDate": "2026-12-03T20:00:00+01:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
  "location": {
    "@type": "Place",
    "name": "Acme Studio",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Torstrasse 1",
      "addressLocality": "Berlin",
      "postalCode": "10119",
      "addressCountry": "DE"
    }
  }
}
```

For an online event, use `"eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode"` and `"location": { "@type": "VirtualLocation", "url": "https://www.example.com/live" }`.

## JobPosting

```json
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "Senior Frontend Engineer",
  "description": "<p>Build the invoicing dashboard used by 4,000 agencies.</p>",
  "datePosted": "2026-10-20",
  "validThrough": "2026-12-31T23:59:59+00:00",
  "employmentType": "FULL_TIME",
  "hiringOrganization": { "@type": "Organization", "name": "Acme", "sameAs": "https://www.example.com/" },
  "jobLocationType": "TELECOMMUTE",
  "applicantLocationRequirements": { "@type": "Country", "name": "Germany" }
}
```

For an on-site job, replace the last two properties with `"jobLocation": { "@type": "Place", "address": { "@type": "PostalAddress", "addressLocality": "Berlin", "addressCountry": "DE" } }`.

## Recipe

```json
{
  "@context": "https://schema.org",
  "@type": "Recipe",
  "name": "Weeknight Tomato Soup",
  "image": ["https://www.example.com/recipes/tomato-soup-1200.jpg"],
  "author": { "@type": "Person", "name": "Dana Smith" },
  "datePublished": "2026-02-01",
  "recipeIngredient": ["800 g canned tomatoes", "1 onion", "500 ml stock"],
  "recipeInstructions": [
    { "@type": "HowToStep", "text": "Soften the onion in olive oil for 5 minutes." },
    { "@type": "HowToStep", "text": "Add tomatoes and stock, simmer 20 minutes, then blend." }
  ]
}
```

## VideoObject

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "Acme product tour",
  "description": "A two-minute tour of sending and chasing invoices in Acme.",
  "thumbnailUrl": ["https://www.example.com/video/tour-thumb-1280.jpg"],
  "uploadDate": "2026-09-01T08:00:00+00:00",
  "duration": "PT2M14S",
  "contentUrl": "https://www.example.com/video/tour.mp4"
}
```

## SoftwareApplication

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Acme Invoicing",
  "operatingSystem": "Web",
  "applicationCategory": "BusinessApplication",
  "offers": { "@type": "Offer", "price": "12.00", "priceCurrency": "USD" },
  "aggregateRating": { "@type": "AggregateRating", "ratingValue": "4.7", "ratingCount": "312" }
}
```

Without real ratings or reviews on the page, the rich result is not possible; leave `schema_required_missing` open and say so.

## LocalBusiness (use the most specific subtype)

```json
{
  "@context": "https://schema.org",
  "@type": "Dentist",
  "@id": "https://www.example.com/#business",
  "name": "Smile Dental Berlin",
  "url": "https://www.example.com/",
  "image": "https://www.example.com/images/practice.jpg",
  "telephone": "+49-30-1234567",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Torstrasse 1",
    "addressLocality": "Berlin",
    "postalCode": "10119",
    "addressCountry": "DE"
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "08:00",
      "closes": "18:00"
    }
  ]
}
```

A LocalBusiness subtype also satisfies `schema_home_identity`.

## FAQPage (only for a visible FAQ; no Google rich result since May 2026)

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Can I cancel at any time?",
      "acceptedAnswer": { "@type": "Answer", "text": "Yes. Plans renew monthly and you can cancel from Settings > Billing." }
    }
  ]
}
```
