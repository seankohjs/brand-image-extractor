import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Code, Copy, Check } from "lucide-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { toast } from "sonner";

export default function ApiDocs() {
  const [, navigate] = useLocation();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const baseUrl = window.location.origin;

  const endpoints = [
    {
      method: "POST",
      path: "/api/trpc/api.extract",
      title: "Extract Brand Assets (Synchronous)",
      description: "Crawls a website and returns all extracted images and brand kit data. Waits for completion before returning.",
      input: `{
  "url": "https://example.com",
  "maxPages": 10,
  "downloadImages": true,
  "filterBlurry": true,
  "filterNoDescription": false
}`,
      response: `{
  "success": true,
  "jobId": 123,
  "url": "https://example.com",
  "duration": "45.2s",
  "stats": {
    "pagesVisited": 10,
    "imagesFound": 150,
    "imagesReturned": 85
  },
  "brandKit": {
    "colors": [
      { "hex": "#1a1a2e", "percentage": 35.5 },
      { "hex": "#16213e", "percentage": 28.3 }
    ],
    "fonts": [
      { "family": "Inter", "weights": ["400", "600", "700"] }
    ],
    "cssColors": ["#ffffff", "#000000", "#3b82f6"],
    "screenshotUrl": "https://..."
  },
  "images": [
    {
      "originalUrl": "https://example.com/image.jpg",
      "storedUrl": "https://storage.../image.jpg",
      "pageUrl": "https://example.com/page",
      "altText": "Product image",
      "title": "Product Title",
      "labels": ["product", "hero"],
      "width": 1200,
      "height": 800,
      "isBlurry": false,
      "blurScore": 245.6,
      "dominantColors": [...]
    }
  ],
  "errors": []
}`,
      curl: `curl -X POST "${baseUrl}/api/trpc/api.extract" \\
  -H "Content-Type: application/json" \\
  -d '{"json":{"url":"https://example.com","maxPages":10,"filterBlurry":true}}'`,
    },
    {
      method: "POST",
      path: "/api/trpc/api.startCrawl",
      title: "Start Async Crawl",
      description: "Starts a crawl job in the background and returns immediately with a job ID. Use getJob to check status.",
      input: `{
  "url": "https://example.com",
  "maxPages": 20
}`,
      response: `{
  "jobId": 123,
  "status": "started"
}`,
      curl: `curl -X POST "${baseUrl}/api/trpc/api.startCrawl" \\
  -H "Content-Type: application/json" \\
  -d '{"json":{"url":"https://example.com","maxPages":20}}'`,
    },
    {
      method: "GET",
      path: "/api/trpc/api.getJob",
      title: "Get Job Status & Results",
      description: "Retrieves the status of a crawl job and its results if completed.",
      input: `{
  "jobId": 123,
  "filterBlurry": false,
  "filterNoDescription": false
}`,
      response: `{
  "jobId": 123,
  "url": "https://example.com",
  "status": "completed",
  "progress": null,
  "stats": {
    "pagesVisited": 20,
    "totalImages": 150,
    "imagesReturned": 150
  },
  "brandKit": { ... },
  "images": [ ... ],
  "error": null,
  "createdAt": "2024-01-15T10:30:00Z",
  "completedAt": "2024-01-15T10:32:45Z"
}`,
      curl: `curl "${baseUrl}/api/trpc/api.getJob?input=%7B%22json%22%3A%7B%22jobId%22%3A123%7D%7D"`,
    },
    {
      method: "GET",
      path: "/api/trpc/api.listJobs",
      title: "List Recent Jobs",
      description: "Returns a list of recent crawl jobs.",
      input: `{
  "limit": 20
}`,
      response: `[
  {
    "jobId": 123,
    "url": "https://example.com",
    "status": "completed",
    "pagesVisited": 20,
    "totalImages": 150,
    "createdAt": "2024-01-15T10:30:00Z",
    "completedAt": "2024-01-15T10:32:45Z"
  }
]`,
      curl: `curl "${baseUrl}/api/trpc/api.listJobs?input=%7B%22json%22%3A%7B%22limit%22%3A20%7D%7D"`,
    },
    {
      method: "POST",
      path: "/api/trpc/api.deleteJob",
      title: "Delete Job",
      description: "Deletes a crawl job and all associated data.",
      input: `{
  "jobId": 123
}`,
      response: `{
  "success": true
}`,
      curl: `curl -X POST "${baseUrl}/api/trpc/api.deleteJob" \\
  -H "Content-Type: application/json" \\
  -d '{"json":{"jobId":123}}'`,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="ml-4">
            <h1 className="font-semibold text-lg">API Documentation</h1>
            <p className="text-xs text-muted-foreground">Brand Image Extractor API Reference</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 max-w-4xl">
        {/* Overview */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="w-5 h-5" />
              API Overview
            </CardTitle>
            <CardDescription>
              The Brand Image Extractor API allows you to programmatically extract images and brand assets from any website.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Base URL</h3>
              <code className="bg-muted px-3 py-1.5 rounded text-sm">{baseUrl}</code>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Authentication</h3>
              <p className="text-muted-foreground">No authentication required. All endpoints are public.</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Request Format</h3>
              <p className="text-muted-foreground">
                All requests use tRPC format. For mutations (POST), send JSON with a <code className="bg-muted px-1 rounded">json</code> wrapper.
                For queries (GET), URL-encode the input parameter.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Endpoints */}
        <div className="space-y-6">
          {endpoints.map((endpoint, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge variant={endpoint.method === "GET" ? "secondary" : "default"}>
                    {endpoint.method}
                  </Badge>
                  <code className="text-sm">{endpoint.path}</code>
                </div>
                <CardTitle className="text-lg mt-2">{endpoint.title}</CardTitle>
                <CardDescription>{endpoint.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-2">Input Parameters</h4>
                  <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
                    {endpoint.input}
                  </pre>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-2">Response</h4>
                  <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto max-h-64">
                    {endpoint.response}
                  </pre>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-sm">cURL Example</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(endpoint.curl, index)}
                    >
                      {copiedIndex === index ? (
                        <Check className="w-4 h-4 mr-1" />
                      ) : (
                        <Copy className="w-4 h-4 mr-1" />
                      )}
                      Copy
                    </Button>
                  </div>
                  <pre className="bg-zinc-900 text-zinc-100 p-3 rounded-lg text-sm overflow-x-auto">
                    {endpoint.curl}
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Usage Examples */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>JavaScript/TypeScript Example</CardTitle>
            <CardDescription>Using fetch to call the API</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg text-sm overflow-x-auto">
{`// Synchronous extraction (waits for completion)
const response = await fetch('${baseUrl}/api/trpc/api.extract', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    json: {
      url: 'https://example.com',
      maxPages: 10,
      filterBlurry: true,
      downloadImages: true
    }
  })
});

const data = await response.json();
console.log('Brand colors:', data.result.data.brandKit.colors);
console.log('Images found:', data.result.data.images.length);

// Download images
for (const image of data.result.data.images) {
  console.log('Image URL:', image.storedUrl || image.originalUrl);
  console.log('Labels:', image.labels);
}`}
            </pre>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Python Example</CardTitle>
            <CardDescription>Using requests library</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-zinc-900 text-zinc-100 p-4 rounded-lg text-sm overflow-x-auto">
{`import requests

# Synchronous extraction
response = requests.post(
    '${baseUrl}/api/trpc/api.extract',
    json={
        'json': {
            'url': 'https://example.com',
            'maxPages': 10,
            'filterBlurry': True,
            'downloadImages': True
        }
    }
)

data = response.json()['result']['data']
print('Brand colors:', data['brandKit']['colors'])
print('Fonts:', data['brandKit']['fonts'])

# Download images
for image in data['images']:
    print(f"Image: {image['storedUrl'] or image['originalUrl']}")
    print(f"Labels: {image['labels']}")`}
            </pre>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
