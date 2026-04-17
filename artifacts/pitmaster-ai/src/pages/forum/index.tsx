import { AppLayout } from "@/components/layout/app-layout";
import { useListForumPosts, getListForumPostsQueryKey, useCreateForumPost } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageSquare, ThumbsUp, Plus, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";

const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.string().min(1, "Category is required"),
  authorName: z.string().min(1, "Author name is required")
});

type PostFormValues = z.infer<typeof postSchema>;

export default function ForumList() {
  const [category, setCategory] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  
  const { data: posts, isLoading } = useListForumPosts({ 
    category: category || undefined 
  });
  
  const createPost = useCreateForumPost();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<PostFormValues>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      title: "",
      content: "",
      category: "general",
      authorName: "KnowYourPit User"
    }
  });

  const onSubmit = (data: PostFormValues) => {
    createPost.mutate({
      data: {
        title: data.title,
        content: data.content,
        category: data.category,
        authorName: data.authorName
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListForumPostsQueryKey() });
        setOpen(false);
        toast({ title: "Post created!" });
        form.reset();
      },
      onError: () => {
        toast({ title: "Failed to create post", variant: "destructive" });
      }
    });
  };

  const categories = ["General", "Technique", "Equipment", "Showcase", "Help"];

  return (
    <AppLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Community Pit</h1>
            <p className="text-muted-foreground">Share knowledge, ask questions, show off your bark.</p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-new-post">
                <Plus className="w-4 h-4 mr-2" /> New Post
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a new post</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Best rub for pork butt?" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map(c => (
                              <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content</FormLabel>
                        <FormControl>
                          <Textarea placeholder="What's on your mind?" className="min-h-[100px]" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="authorName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display Name</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={createPost.isPending}>
                    {createPost.isPending ? "Posting..." : "Post"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-2 overflow-x-auto w-full pb-2 scrollbar-hide">
          <Button 
            variant={category === null ? "default" : "outline"} 
            size="sm"
            onClick={() => setCategory(null)}
            className="rounded-full"
          >
            All Topics
          </Button>
          {categories.map(c => (
            <Button 
              key={c}
              variant={category === c.toLowerCase() ? "default" : "outline"} 
              size="sm"
              onClick={() => setCategory(c.toLowerCase())}
              className="rounded-full whitespace-nowrap"
            >
              {c}
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-40 w-full" />
            ))}
          </div>
        ) : posts?.length ? (
          <div className="space-y-4">
            {posts.map(post => (
              <Link key={post.id} href={`/forum/${post.id}`}>
                <Card className="hover:border-primary transition-colors cursor-pointer" data-testid={`forum-post-${post.id}`}>
                  <CardHeader className="pb-3 flex flex-row items-start gap-4">
                    <Avatar className="w-10 h-10 border mt-1">
                      {post.authorAvatar ? (
                        <AvatarImage src={post.authorAvatar} />
                      ) : (
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {post.authorName.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      )}
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-xl line-clamp-1">{post.title}</CardTitle>
                        <Badge variant="outline" className="uppercase text-[10px] ml-2 shrink-0">{post.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Posted by <span className="font-medium text-foreground">{post.authorName}</span> • {new Date(post.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="pb-3">
                    <p className="text-muted-foreground line-clamp-2">
                      {post.content}
                    </p>
                  </CardContent>
                  <CardFooter className="pt-0 text-sm text-muted-foreground flex gap-6 border-t mt-4 py-3 bg-muted/10">
                    <div className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                      <ThumbsUp className="w-4 h-4" />
                      <span>{post.likesCount}</span>
                    </div>
                    <div className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                      <MessageSquare className="w-4 h-4" />
                      <span>{post.commentsCount} comments</span>
                    </div>
                  </CardFooter>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 border border-dashed rounded-lg bg-muted/20">
            <MessageSquare className="w-12 h-12 mx-auto text-muted-foreground mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No posts found</h3>
            <p className="text-muted-foreground mb-4">Be the first to start a conversation in this category.</p>
            <Button variant="outline" onClick={() => setOpen(true)}>Start a Discussion</Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
