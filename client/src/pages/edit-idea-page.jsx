import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { IdeaRow } from '@/components/idea-row';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, X, Sparkles } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
import { IdeaExtraFields, extraFieldsSchema, extraFieldsPayload } from '@/components/idea-extra-fields';
import { cn } from '@/lib/utils';

const CATEGORIES = ['Tech', 'Design', 'Social', 'Education', 'Business', 'Other'];

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(80, 'Title cannot exceed 80 characters'),
  pitch: z
    .string()
    .trim()
    .min(10, 'Tagline must be at least 10 characters')
    .max(140, 'Tagline cannot exceed 140 characters'),
  description: z
    .string()
    .trim()
    .min(20, 'Please write a brief description (at least 20 characters)')
    .max(5000, 'Description cannot exceed 5000 characters'),
  category: z.enum(['Tech', 'Design', 'Social', 'Education', 'Business', 'Other']),
  ...extraFieldsSchema,
  // Older ideas were posted before these fields existed, so editing must not force them.
  problem: z.string().trim().max(1000).optional(),
  target_buyer: z.string().trim().max(200).optional(),
});

export function EditIdeaPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();

  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [publishNow, setPublishNow] = useState(false);

  const { data, isLoading: ideaLoading } = useQuery({
    queryKey: ['idea-detail', id],
    queryFn: () => api.get(`/ideas/${id}`),
  });

  const idea = data?.data?.idea;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (idea) {
      reset({
        title: idea.title,
        pitch: idea.pitch,
        description: idea.description,
        category: idea.category,
        problem: idea.problem || '',
        target_buyer: idea.target_buyer || '',
        suggested_price: idea.suggested_price ?? '',
        how_it_works: idea.how_it_works || '',
        competitors: idea.competitors || '',
        link_url: idea.link_url || '',
      });
      setTags(idea.tags || []);
    }
  }, [idea, reset]);

  const selectedCategory = watch('category');
  const watchedTitle = watch('title');
  const watchedPitch = watch('pitch');
  const watchedDesc = watch('description');

  if (authLoading || ideaLoading) {
    return (
      <div className="min-h-screen bg-bg text-ink py-12">
        <div className="max-w-[1140px] mx-auto px-4 sm:px-6 space-y-6">
          <Skeleton className="h-8 w-40 rounded-[8px]" />
          <Skeleton className="h-48 w-full rounded-[12px]" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login?redirect=/ideas/${id}/edit`} replace />;
  }

  const isAuthor = user && idea && user.id === idea.author?.id;
  if (!isAuthor && !isAdmin) {
    toast.error('You do not have permission to edit this idea.');
    return <Navigate to={`/ideas/${id}`} replace />;
  }

  const handleAddTag = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#/, '').replace(/,/g, '');
      if (clean && !tags.includes(clean) && tags.length < 5) {
        setTags([...tags, clean]);
        setTagInput('');
      }
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const onSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      await api.put(`/ideas/${id}`, {
        title: values.title.trim(),
        pitch: values.pitch.trim(),
        description: values.description.trim(),
        category: values.category,
        tags,
        ...extraFieldsPayload(values),
        ...(publishNow ? { status: 'published' } : {}),
      });
      toast.success(publishNow ? 'Your idea is live!' : 'Idea updated successfully.');
      queryClient.invalidateQueries(['idea-detail', id]);
      queryClient.invalidateQueries(['ideas-feed']);
      navigate(`/ideas/${id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to update idea.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const previewIdea = {
    id: idea?.id || 1,
    title: watchedTitle || idea?.title,
    pitch: watchedPitch || idea?.pitch,
    category: selectedCategory || idea?.category,
    author: idea?.author || user,
    stats: idea?.stats || { avg_score: 5.0, total_ratings: 1, comments_count: 0 },
    tags,
  };

  return (
    <div className="min-h-screen bg-bg text-ink py-8 sm:py-12">
      <main className="max-w-[1140px] mx-auto px-4 sm:px-6 space-y-8">
        <Link
          to={`/ideas/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring rounded-[4px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to idea
        </Link>

        <div className="space-y-1 border-b border-border pb-5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Edit idea
          </h1>
          <p className="text-sm text-ink-muted">
            Update your concept title, pitch, description, and categories.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form */}
          <div className="lg:col-span-7">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Category */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-ink block">
                  Category
                </label>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category selection">
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        onClick={() => setValue('category', cat, { shouldValidate: true })}
                        className={cn(
                          'px-3.5 py-1.5 text-xs font-medium rounded-full border transition-colors min-h-[34px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
                          isSelected
                            ? 'bg-accent-strong text-accent-ink border-accent-strong font-bold'
                            : 'border-border bg-surface text-ink-muted hover:text-ink hover:border-border-strong hover:bg-surface-hover'
                        )}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title (max 60) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label htmlFor="edit-title" className="font-bold uppercase tracking-wider text-ink">
                    Title <span className="text-danger">*</span>
                  </label>
                  <span className="text-ink-muted tabular-nums">
                    {(watchedTitle || '').length} / 80
                  </span>
                </div>
                <Input
                  id="edit-title"
                  {...register('title')}
                  maxLength={80}
                  hasError={!!errors.title}
                  className="h-11"
                />
                {errors.title && (
                  <p className="text-xs text-danger">{errors.title.message}</p>
                )}
              </div>

              {/* Tagline (max 100) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label htmlFor="edit-pitch" className="font-bold uppercase tracking-wider text-ink">
                    Tagline <span className="text-danger">*</span>
                  </label>
                  <span className="text-ink-muted tabular-nums">
                    {(watchedPitch || '').length} / 140
                  </span>
                </div>
                <Input
                  id="edit-pitch"
                  {...register('pitch')}
                  maxLength={140}
                  hasError={!!errors.pitch}
                  className="h-11"
                />
                {errors.pitch && (
                  <p className="text-xs text-danger">{errors.pitch.message}</p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label htmlFor="edit-desc" className="font-bold uppercase tracking-wider text-ink">
                    Description <span className="text-danger">*</span>
                  </label>
                  <span className="text-ink-muted tabular-nums">
                    {(watchedDesc || '').length} / 5000
                  </span>
                </div>
                <Textarea
                  id="edit-desc"
                  rows={6}
                  {...register('description')}
                  maxLength={5000}
                  hasError={!!errors.description}
                  className="min-h-[140px]"
                />
                {errors.description && (
                  <p className="text-xs text-danger">{errors.description.message}</p>
                )}
              </div>

              <IdeaExtraFields register={register} errors={errors} />
              {idea?.status === 'published' && (
                <p className="text-[11px] text-ink-muted">Changes to the title, tagline or description are kept in the public edit history, so ratings stay fair.</p>
              )}

              {/* Tags */}
              <div className="space-y-2">
                <label htmlFor="edit-tags" className="text-xs font-bold uppercase tracking-wider text-ink block">
                  Tags (up to 5)
                </label>
                <div className="flex flex-wrap gap-1.5 items-center p-2 rounded-[8px] border border-border-strong bg-surface min-h-[44px]">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 text-xs bg-surface-muted text-ink px-2.5 py-1 rounded-full border border-border"
                    >
                      #{tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-danger p-0.5 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring"
                        aria-label={`Remove tag ${tag}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {tags.length < 5 && (
                    <input
                      id="edit-tags"
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder={tags.length === 0 ? "Type tag & press Enter..." : "Add tag..."}
                      className="flex-1 bg-surface text-xs border-none outline-none min-w-[120px] text-ink placeholder:text-ink-faint"
                    />
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-border justify-end">
                <Link to={`/ideas/${id}`}>
                  <Button type="button" variant="ghost" className="rounded-[8px] h-11 text-xs">
                    Cancel
                  </Button>
                </Link>
                {idea?.status === 'draft' && (
                  <Button
                    type="submit"
                    variant="secondary"
                    onClick={() => setPublishNow(true)}
                    disabled={isSubmitting}
                    className="rounded-[8px] h-11 px-4 font-semibold text-sm"
                  >
                    Save and publish
                  </Button>
                )}
                <Button
                  type="submit"
                  onClick={() => setPublishNow(false)}
                  isLoading={isSubmitting}
                  className="rounded-[8px] h-11 px-6 font-semibold text-sm"
                >
                  {idea?.status === 'draft' ? 'Save draft' : 'Save changes'}
                </Button>
              </div>
            </form>
          </div>

          {/* Desktop Preview */}
          <div className="hidden lg:block lg:col-span-5 sticky top-24">
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-accent-strong" /> Live Row Preview
              </span>
              <div className="p-4 rounded-[12px] border border-dashed border-border bg-surface-muted">
                <IdeaRow idea={previewIdea} showRank={false} />
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
