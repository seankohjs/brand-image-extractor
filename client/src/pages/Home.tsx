import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, Image, Clock, CheckCircle2, XCircle, Play, Trash2, Code } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

// Type for crawl job from the API
interface CrawlJob {
  id: number;
  targetUrl: string;
  status: string;
  totalPages: number | null;
  crawledPages: number | null;
  totalImages: number | null;
  createdAt: Date;
  completedAt: Date | null;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [maxPages, setMaxPages] = useState(20);
  const [, navigate] = useLocation();

  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = trpc.crawl.list.useQuery();

  const startCrawl = trpc.crawl.start.useMutation({
    onSuccess: (data) => {
      toast.success("Crawl started!");
      setUrl("");
      refetchJobs();
      navigate(`/job/${data.jobId}`);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteCrawl = trpc.crawl.delete.useMutation({
    onSuccess: () => {
      toast.success("Job deleted");
      refetchJobs();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast.error("Please enter a URL");
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      toast.error("Please enter a valid URL (including https://)");
      return;
    }

    startCrawl.mutate({ url, maxPages });
  };

  const handleDelete = (jobId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this job?")) {
      deleteCrawl.mutate({ jobId });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Completed</Badge>;
      case "running":
        return <Badge className="bg-blue-500 hover:bg-blue-600"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500 hover:bg-yellow-600"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
      case "failed":
        return <Badge className="bg-red-500 hover:bg-red-600"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary text-primary-foreground">
              <Image className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">Brand Image Extractor</h1>
              <p className="text-xs text-muted-foreground">Extract images from any website</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/api-docs")}>
            <Code className="w-4 h-4 mr-2" />
            API Docs
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {/* URL Input Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              Start New Crawl
            </CardTitle>
            <CardDescription>
              Enter a website URL to extract all images with their metadata
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex gap-4">
              <Input
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1"
              />
              <Input
                type="number"
                min={1}
                max={50}
                value={maxPages}
                onChange={(e) => setMaxPages(parseInt(e.target.value) || 20)}
                className="w-24"
              />
              <Button type="submit" disabled={startCrawl.isPending}>
                {startCrawl.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Start Crawl
              </Button>
            </form>
            <p className="text-sm text-muted-foreground mt-2">
              Max pages to crawl: {maxPages}. The crawler will extract images from up to {maxPages} pages on the target website.
            </p>
          </CardContent>
        </Card>

        {/* Jobs List */}
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-lg font-semibold mb-4">Recent Crawl Jobs</h2>
            {jobsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : jobs && jobs.length > 0 ? (
              <div className="grid gap-4">
                {(jobs as CrawlJob[]).map((job) => (
                  <Card key={job.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            {getStatusBadge(job.status)}
                            <span className="text-sm text-muted-foreground">
                              {new Date(job.createdAt).toLocaleDateString()} {new Date(job.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="font-medium truncate">{job.targetUrl}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>{job.crawledPages ?? 0} / {job.totalPages ?? 0} pages</span>
                            <span>{job.totalImages ?? 0} images</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/job/${job.id}`)}
                          >
                            View Results
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => handleDelete(job.id, e)}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Image className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No crawl jobs yet</p>
                <p className="text-sm">Enter a URL above to start extracting images</p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
