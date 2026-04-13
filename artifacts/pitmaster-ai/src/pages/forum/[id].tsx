import { AppLayout } from "@/components/layout/app-layout";
import { useParams, Link } from "wouter";
import { 
  useGetForumPost, 
  getGetForumPostQueryKey,
  useLikeForumPost,
  useCreateForumComment
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, MessageSquare, ThumbsUp, Send } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ForumPostDetail() {
  const { id } = useParams();
  const postId = parseInt(id || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [commentContent, setCommentContent] = useState("");

  const { data: detail, isLoading } = useGetForumPost(postId, { 
    query: { enabled: !!postId, queryKey: getGetForumPostQueryKey(postId) } 
  });

  const likePost = useLikeForumPost();
  const createComment = useCreateForumComment();

  const handleLike = () => {
    likePost.mutate({ id: postId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetForumPostQueryKey(postId) });
      }
    });
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;

    createComment.mutate({
      data: {
        content: commentContent,
        authorName: "PitKing User" // Mock logged in user
      }
    }, {
      onSuccess: () => {
        setCommentContent("");
        queryClient.invalidateQueries({ queryKey: getGetForumPostQueryKey(postId) });
        toast({ title: "Comment posted" });
      }
    });
  };

  if (isLoading || !detail) {
    return (
      <AppLayout>
        <div className="space-y-6 max-w-3xl mx-auto">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AppLayout>
    );
  }

  const { post, comments } = detail;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" size="sm" asChild className="pl-0 hover:bg-transparent">
          <Link href="/forum">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Forum
          </Link>
        </Button>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <Badge className="uppercase tracking-widest text-[10px]">{post.category}</Badge>
              <span className="text-sm text-muted-foreground">{new Date(post.createdAt).toLocaleDateString()}</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{post.title}</h1>
            
            <div className="flex items-center gap-3 mt-4">
              <Avatar className="w-10 h-10 border">
                {post.authorAvatar ? (
                  <AvatarImage src={post.authorAvatar} />
                ) : (
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {post.authorName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="text-sm">
                <p className="font-medium">{post.authorName}</p>
                <p className="text-muted-foreground text-xs">Original Poster</p>
              </div>
            </div>
          </div>

          {post.imageUrl && (
            <div className="w-full rounded-xl overflow-hidden bg-muted border">
              <img src={post.imageUrl} alt="Attached" className="w-full h-auto max-h-[500px] object-cover" />
            </div>
          )}

          <div className="prose dark:prose-invert max-w-none prose-p:leading-relaxed text-foreground whitespace-pre-wrap">
            {post.content}
          </div>

          <div className="flex items-center gap-4 pt-6 border-t">
            <Button 
              variant="outline" 
              onClick={handleLike}
              disabled={likePost.isPending}
              className="gap-2"
              data-testid="btn-like-post"
            >
              <ThumbsUp className="w-4 h-4" />
              <span>{post.likesCount}</span>
            </Button>
            <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
              <MessageSquare className="w-4 h-4" />
              <span>{post.commentsCount} Comments</span>
            </div>
          </div>
        </div>

        <div className="pt-8 space-y-6 border-t border-border/50">
          <h2 className="text-2xl font-bold">Discussion</h2>
          
          <form onSubmit={handleComment} className="flex gap-4">
            <Avatar className="w-10 h-10 border shrink-0 mt-1 hidden sm:block">
              <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Textarea 
                placeholder="Add to the discussion..." 
                value={commentContent}
                onChange={e => setCommentContent(e.target.value)}
                className="min-h-[100px] bg-card"
                data-testid="input-comment"
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={!commentContent.trim() || createComment.isPending} data-testid="btn-submit-comment">
                  <Send className="w-4 h-4 mr-2" /> Post Reply
                </Button>
              </div>
            </div>
          </form>

          <div className="space-y-4 pt-4">
            {comments.map(comment => (
              <div key={comment.id} className="flex gap-4 p-4 rounded-lg bg-card border" data-testid={`comment-${comment.id}`}>
                <Avatar className="w-10 h-10 border shrink-0">
                  {comment.authorAvatar ? (
                    <AvatarImage src={comment.authorAvatar} />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {comment.authorName.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex justify-between items-center">
                    <p className="font-medium text-sm">{comment.authorName}</p>
                    <span className="text-xs text-muted-foreground">{new Date(comment.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                    {comment.content}
                  </p>
                </div>
              </div>
            ))}
            
            {comments.length === 0 && (
              <div className="text-center py-12 text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                <MessageSquare className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>No comments yet. Be the first to reply!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
