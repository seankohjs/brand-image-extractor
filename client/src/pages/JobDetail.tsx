import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, ArrowLeft, Image, Download, CheckCircle2, XCircle, 
  Clock, Globe, Tag, ExternalLink, X, Plus, Palette, Type, Eye, EyeOff, Sparkles
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { ExtractedImage } from "../../../drizzle/schema";

interface ColorInfo {
  hex: string;
  rgb: { r: number; g: number; b: number };
  percentage: number;
}

export default function JobDetail() {
  const { id } = useParams<{ id: string }>();
  const jobId = parseInt(id || "0", 10);
  const [, navigate] = useLocation();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [selectedImage, setSelectedImage] = useState<ExtractedImage | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [filterBlurry, setFilterBlurry] = useState(true);
  const [filterNoDescription, setFilterNoDescription] = useState(false);

  // Fetch job status with polling when running
  const { data: jobData, isLoading: jobLoading } = trpc.crawl.getStatus.useQuery(
    { jobId },
    { 
      enabled: isAuthenticated && jobId > 0,
      refetchInterval: (query) => {
        const data = query.state.data;
        if (data?.status === "running" || data?.status === "pending") {
          return 2000;
        }
        return false;
      },
    }
  );

  // Fetch images with filters
  const { data: images, isLoading: imagesLoading, refetch: refetchImages } = trpc.images.getByCrawlJob.useQuery(
    { crawlJobId: jobId, filterBlurry, filterNoDescription },
    { 
      enabled: isAuthenticated && jobId > 0 && jobData?.status === "completed",
    }
  );

  // Update labels mutation
  const updateLabels = trpc.images.updateLabels.useMutation({
    onSuccess: () => {
      toast.success("Labels updated");
      refetchImages();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Refetch images when job completes or filters change
  useEffect(() => {
    if (jobData?.status === "completed") {
      refetchImages();
    }
  }, [jobData?.status, filterBlurry, filterNoDescription, refetchImages]);

  const handleAddLabel = () => {
    if (!selectedImage || !newLabel.trim()) return;
    const currentLabels = (selectedImage.labels as string[]) || [];
    if (!currentLabels.includes(newLabel.trim())) {
      updateLabels.mutate({
        imageId: selectedImage.id,
        labels: [...currentLabels, newLabel.trim()],
      });
      setSelectedImage({
        ...selectedImage,
        labels: [...currentLabels, newLabel.trim()],
      });
    }
    setNewLabel("");
  };

  const handleRemoveLabel = (label: string) => {
    if (!selectedImage) return;
    const currentLabels = (selectedImage.labels as string[]) || [];
    const newLabels = currentLabels.filter((l) => l !== label);
    updateLabels.mutate({
      imageId: selectedImage.id,
      labels: newLabels,
    });
    setSelectedImage({
      ...selectedImage,
      labels: newLabels,
    });
  };

  const handleDownload = async () => {
    if (!jobData || !images) return;
    
    const metadata = {
      crawlJob: {
        id: jobData.id,
        targetUrl: jobData.targetUrl,
        crawledAt: jobData.createdAt,
        totalPages: jobData.totalPages,
        totalImages: jobData.totalImages,
      },
      brandKit: {
        colors: jobData.brandColors,
        fonts: jobData.brandFonts,
        cssColors: jobData.cssColors,
        screenshotUrl: jobData.screenshotUrl,
      },
      images: images.map((img) => ({
        id: img.id,
        originalUrl: img.originalUrl,
        s3Url: img.s3Url,
        pageUrl: img.pageUrl,
        altText: img.altText,
        title: img.title,
        labels: img.labels,
        width: img.width,
        height: img.height,
        mimeType: img.mimeType,
        isBlurry: img.isBlurry,
        blurScore: img.blurScore,
        dominantColors: img.dominantColors,
      })),
    };

    const blob = new Blob([JSON.stringify(metadata, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brand-kit-${jobId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Brand kit exported");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      case "running":
        return <Badge variant="default" className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Running</Badge>;
      case "completed":
        return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading || jobLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate("/");
    return null;
  }

  if (!jobData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
            <p className="text-lg font-medium">Job not found</p>
            <Button className="mt-4" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = jobData.progress;
  const progressPercent = progress 
    ? Math.round((progress.crawledPages / Math.max(progress.totalPages, 1)) * 100)
    : jobData.status === "completed" ? 100 : 0;

  const brandColors = (jobData.brandColors as ColorInfo[]) || [];
  const brandFonts = (jobData.brandFonts as Array<{ family: string; weights: string[]; usage: string; count: number }>) || [];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-lg font-semibold">Crawl Job #{jobId}</h1>
              <p className="text-sm text-muted-foreground truncate max-w-md">{jobData.targetUrl}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge(jobData.status)}
            {jobData.status === "completed" && (
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Export Brand Kit
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Progress Section */}
        {(jobData.status === "running" || jobData.status === "pending") && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Crawling in Progress
              </CardTitle>
              <CardDescription>
                {progress?.currentPage || "Starting..."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Pages crawled</span>
                  <span>{progress?.crawledPages || 0} / {progress?.totalPages || "?"}</span>
                </div>
                <Progress value={progressPercent} className="h-2" />
              </div>
              <div className="flex gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  <span>{progress?.crawledPages || 0} pages</span>
                </div>
                <div className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  <span>{progress?.totalImages || 0} images found</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {jobData.status === "failed" && jobData.errorMessage && (
          <Card className="mb-8 border-destructive">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Crawl Failed</p>
                  <p className="text-sm text-muted-foreground mt-1">{jobData.errorMessage}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completed Content */}
        {jobData.status === "completed" && (
          <Tabs defaultValue="brand-kit" className="space-y-6">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="brand-kit" className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Brand Kit
              </TabsTrigger>
              <TabsTrigger value="images" className="flex items-center gap-2">
                <Image className="w-4 h-4" />
                Images ({images?.length || 0})
              </TabsTrigger>
            </TabsList>

            {/* Brand Kit Tab */}
            <TabsContent value="brand-kit" className="space-y-6">
              {/* Screenshot Preview */}
              {jobData.screenshotUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="w-5 h-5" />
                      Page Screenshot
                    </CardTitle>
                    <CardDescription>Visual preview of the crawled website</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-lg overflow-hidden border">
                      <img 
                        src={jobData.screenshotUrl} 
                        alt="Website screenshot" 
                        className="w-full h-auto max-h-[400px] object-contain bg-muted"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Brand Colors */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="w-5 h-5" />
                    Brand Colors
                  </CardTitle>
                  <CardDescription>Dominant colors extracted from the website</CardDescription>
                </CardHeader>
                <CardContent>
                  {brandColors.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-3">
                        {brandColors.map((color, i) => (
                          <div key={i} className="flex flex-col items-center gap-2">
                            <div 
                              className="w-16 h-16 rounded-lg border shadow-sm cursor-pointer hover:scale-105 transition-transform"
                              style={{ backgroundColor: color.hex }}
                              onClick={() => {
                                navigator.clipboard.writeText(color.hex);
                                toast.success(`Copied ${color.hex}`);
                              }}
                              title={`Click to copy ${color.hex}`}
                            />
                            <span className="text-xs font-mono">{color.hex}</span>
                            <span className="text-xs text-muted-foreground">{color.percentage}%</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground">Click any color to copy its hex code</p>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No colors extracted</p>
                  )}
                </CardContent>
              </Card>

              {/* Brand Fonts */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Type className="w-5 h-5" />
                    Typography
                  </CardTitle>
                  <CardDescription>Fonts used on the website</CardDescription>
                </CardHeader>
                <CardContent>
                  {brandFonts.length > 0 ? (
                    <div className="space-y-4">
                      {brandFonts.slice(0, 6).map((font, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <div>
                            <p className="font-medium" style={{ fontFamily: font.family }}>
                              {font.family}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {font.usage === "heading" ? "Headings" : font.usage === "body" ? "Body text" : "Other"} • {font.weights.join(", ")}
                            </p>
                          </div>
                          <Badge variant="secondary">{font.count} uses</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">No fonts detected</p>
                  )}
                </CardContent>
              </Card>

              {/* CSS Colors */}
              {jobData.cssColors && (jobData.cssColors as string[]).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5" />
                      CSS Color Palette
                    </CardTitle>
                    <CardDescription>Colors defined in stylesheets</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {(jobData.cssColors as string[]).slice(0, 20).map((color, i) => (
                        <div 
                          key={i}
                          className="w-8 h-8 rounded border cursor-pointer hover:scale-110 transition-transform"
                          style={{ backgroundColor: color }}
                          onClick={() => {
                            navigator.clipboard.writeText(color);
                            toast.success(`Copied ${color}`);
                          }}
                          title={color}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Images Tab */}
            <TabsContent value="images" className="space-y-6">
              {/* Filters */}
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-wrap gap-6">
                    <div className="flex items-center gap-2">
                      <Switch 
                        id="filter-blurry" 
                        checked={filterBlurry}
                        onCheckedChange={setFilterBlurry}
                      />
                      <Label htmlFor="filter-blurry" className="flex items-center gap-2 cursor-pointer">
                        <EyeOff className="w-4 h-4" />
                        Hide blurry images
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch 
                        id="filter-no-desc" 
                        checked={filterNoDescription}
                        onCheckedChange={setFilterNoDescription}
                      />
                      <Label htmlFor="filter-no-desc" className="flex items-center gap-2 cursor-pointer">
                        <Tag className="w-4 h-4" />
                        Only with description
                      </Label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Image Gallery */}
              {imagesLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : images && images.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {images.map((image) => (
                    <Card 
                      key={image.id} 
                      className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
                      onClick={() => setSelectedImage(image)}
                    >
                      <div className="aspect-square bg-muted relative">
                        <img
                          src={image.s3Url || image.originalUrl}
                          alt={image.altText || "Extracted image"}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3Ctext fill='%23999' x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='12'%3ENo Image%3C/text%3E%3C/svg%3E";
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                        {/* Quality indicator */}
                        {image.blurScore !== null && (
                          <div className="absolute top-2 right-2">
                            <Badge 
                              variant={image.isBlurry ? "destructive" : "secondary"}
                              className="text-xs"
                            >
                              {image.isBlurry ? "Blurry" : `${image.blurScore}%`}
                            </Badge>
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <p className="text-sm font-medium truncate">
                          {image.altText || image.title || "No description"}
                        </p>
                        {/* Image colors */}
                        {image.dominantColors && (image.dominantColors as ColorInfo[]).length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {(image.dominantColors as ColorInfo[]).slice(0, 4).map((color, i) => (
                              <div 
                                key={i}
                                className="w-4 h-4 rounded-sm border"
                                style={{ backgroundColor: color.hex }}
                                title={color.hex}
                              />
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No images match the current filters.</p>
                    <p className="text-sm mt-2">Try adjusting the filter settings above.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>

      {/* Image Detail Dialog */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedImage && (
            <>
              <DialogHeader>
                <DialogTitle>Image Details</DialogTitle>
                <DialogDescription>
                  View and edit image metadata and labels
                </DialogDescription>
              </DialogHeader>
              <div className="grid md:grid-cols-2 gap-6 mt-4">
                <div className="space-y-4">
                  <div className="bg-muted rounded-lg overflow-hidden">
                    <img
                      src={selectedImage.s3Url || selectedImage.originalUrl}
                      alt={selectedImage.altText || "Image"}
                      className="w-full h-auto max-h-[400px] object-contain"
                    />
                  </div>
                  {/* Image colors */}
                  {selectedImage.dominantColors && (selectedImage.dominantColors as ColorInfo[]).length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">Image Colors</h4>
                      <div className="flex gap-2">
                        {(selectedImage.dominantColors as ColorInfo[]).map((color, i) => (
                          <div 
                            key={i}
                            className="w-10 h-10 rounded border cursor-pointer hover:scale-110 transition-transform"
                            style={{ backgroundColor: color.hex }}
                            onClick={() => {
                              navigator.clipboard.writeText(color.hex);
                              toast.success(`Copied ${color.hex}`);
                            }}
                            title={`${color.hex} (${color.percentage}%)`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant={selectedImage.isBlurry ? "destructive" : "secondary"}>
                      {selectedImage.isBlurry ? "Blurry" : "Sharp"}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      Quality score: {selectedImage.blurScore}%
                    </span>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Alt Text</h4>
                    <p className="text-sm">{selectedImage.altText || "—"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Title</h4>
                    <p className="text-sm">{selectedImage.title || "—"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Figcaption</h4>
                    <p className="text-sm">{selectedImage.figcaption || "—"}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Dimensions</h4>
                    <p className="text-sm">
                      {selectedImage.width && selectedImage.height 
                        ? `${selectedImage.width} × ${selectedImage.height}` 
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Source Page</h4>
                    <a 
                      href={selectedImage.pageUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {selectedImage.pageUrl.length > 50 
                        ? selectedImage.pageUrl.slice(0, 50) + "..." 
                        : selectedImage.pageUrl}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                      <Tag className="w-4 h-4" />
                      Labels
                    </h4>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {(selectedImage.labels as string[] || []).map((label, i) => (
                        <Badge key={i} variant="secondary" className="pr-1">
                          {label}
                          <button
                            onClick={() => handleRemoveLabel(label)}
                            className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Add a label..."
                        value={newLabel}
                        onChange={(e) => setNewLabel(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddLabel()}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={handleAddLabel} disabled={!newLabel.trim()}>
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="pt-4 flex gap-2">
                    <Button asChild variant="outline" className="flex-1">
                      <a href={selectedImage.s3Url || selectedImage.originalUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Open Original
                      </a>
                    </Button>
                    <Button asChild className="flex-1">
                      <a href={selectedImage.s3Url || selectedImage.originalUrl} download>
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
