import React, { useState } from 'react';
import { useNavigate, Navigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { IdeaRow } from '@/components/idea-row';
import { IdeaExtraFields, DuplicateHint, extraFieldsSchema, extraFieldsDefaults, extraFieldsPayload } from '@/components/idea-extra-fields';
import { ArrowLeft, X, Sparkles, Image } from 'lucide-react';
import api from '@/api/client';
import { toast } from 'sonner';
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
  cover_image: z.string().trim().optional(),
  ...extraFieldsSchema,
});

export function SubmitIdeaPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      pitch: '',
      description: '',
      category: 'Tech',
      cover_image: '',
      ...extraFieldsDefaults,
    },
  });
  const [saveAs, setSaveAs] = useState('published');

  const selectedCategory = watch('category');
  const watchedTitle = watch('title');
  const watchedPitch = watch('pitch');
  const watchedDesc = watch('description');
  const watchedImage = watch('cover_image');

  // Keyboard shortcut: Cmd/Ctrl + Enter submits form
  React.useEffect(() => {
    const handleCmdEnter = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit(onSubmit)();
      }
    };
    window.addEventListener('keydown', handleCmdEnter);
    return () => window.removeEventListener('keydown', handleCmdEnter);
  }, [handleSubmit]);

  if (authLoading) return null;
  if (!isAuthenticated) {
    return <Navigate to="/login?redirect=/submit" replace />;
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
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const payload = {
        title: values.title.trim(),
        pitch: values.pitch.trim(),
        description: values.description.trim(),
        category: values.category,
        tags,
        status: saveAs,
        ...extraFieldsPayload(values),
      };
      const res = await api.post('/ideas', payload);
      if (saveAs === 'draft') {
        toast.success('Draft saved. Only you can see it.');
        navigate(`/ideas/${res.data.idea.id}`);
      } else {
        toast.success('Your idea is live! Share it to get your first votes.');
        navigate(`/ideas/${res.data.idea.id}?posted=1`);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to post idea.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mock Idea object for the live desktop preview
  const previewIdea = {
    id: 9999,
    title: watchedTitle || 'Your product title',
    pitch: watchedPitch || 'A concise, compelling one-line pitch of what you are building.',
    category: selectedCategory,
    cover_image: watchedImage || null,
    tags: tags.length > 0 ? tags : ['preview'],
    author: {
      id: user?.id,
      name: user?.name || 'You',
    },
    stats: {
      avg_score: 5.0,
      total_ratings: 1,
      comments_count: 0,
    },
  };

  return (
    <main className="min-h-screen bg-bg text-ink py-8 sm:py-12">
      <div className="max-w-[1140px] mx-auto px-4 sm:px-6 space-y-8">
        {/* Back Link */}
        <Link
          to="/feed"
          className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-focus-ring rounded-[4px]"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to ideas
        </Link>

        {/* Page Header */}
        <div className="space-y-1 border-b border-border pb-5">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
            Post an idea
          </h1>
          <p className="text-sm text-ink-muted">
            Share a raw product concept, stress-test your premise, and gather honest ratings.
          </p>
        </div>

        {/* Two-Column Layout: Form on Left, Live Row Preview on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Column */}
          <div className="lg:col-span-7">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Category Pills */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-ink block">
                  Category <span className="text-danger">*</span>
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
                        onClick={() => setValue('category', cat)}
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
                  <label htmlFor="idea-title" className="font-bold uppercase tracking-wider text-ink">
                    Title <span className="text-danger">*</span>
                  </label>
                  <span className="text-ink-muted tabular-nums">
                    {(watchedTitle || '').length} / 80
                  </span>
                </div>
                <Input
                  id="idea-title"
                  autoFocus
                  {...register('title')}
                  placeholder="e.g. InvoiceRadar: automatic late-payment reminders"
                  maxLength={80}
                  hasError={!!errors.title}
                  className="h-11"
                />
                {errors.title && (
                  <p className="text-xs text-danger">{errors.title.message}</p>
                )}
                <DuplicateHint title={watchedTitle} />
              </div>

              {/* Tagline / Pitch (max 100) */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label htmlFor="idea-pitch" className="font-bold uppercase tracking-wider text-ink">
                    Tagline <span className="text-danger">*</span>
                  </label>
                  <span className="text-ink-muted tabular-nums">
                    {(watchedPitch || '').length} / 140
                  </span>
                </div>
                <Input
                  id="idea-pitch"
                  {...register('pitch')}
                  placeholder="One sentence: what it does and for whom"
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
                  <label htmlFor="idea-desc" className="font-bold uppercase tracking-wider text-ink">
                    Description & Details <span className="text-danger">*</span>
                  </label>
                  <span className="text-ink-muted tabular-nums">
                    {(watchedDesc || '').length} / 5000
                  </span>
                </div>
                <Textarea
                  id="idea-desc"
                  {...register('description')}
                  placeholder="Explain the problem, your planned approach, audience, and key technical risks..."
                  maxLength={5000}
                  hasError={!!errors.description}
                  className="min-h-[140px]"
                />
                {errors.description && (
                  <p className="text-xs text-danger">{errors.description.message}</p>
                )}
              </div>

              <IdeaExtraFields register={register} errors={errors} />

              {/* Optional Cover Image URL */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <label htmlFor="idea-cover" className="font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                    <Image className="w-3.5 h-3.5 text-ink-muted" /> Cover Image URL <span className="text-ink-faint font-normal lowercase">(optional)</span>
                  </label>
                </div>
                <Input
                  id="idea-cover"
                  {...register('cover_image')}
                  placeholder="https://example.com/logo-or-tile.png"
                  className="h-11 text-xs"
                />
                <p className="text-[11px] text-ink-faint">
                  Leave empty to generate a curated tokenized cover tile with your idea's initials.
                </p>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <label htmlFor="tag-input" className="text-xs font-bold uppercase tracking-wider text-ink block">
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
                      id="tag-input"
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

              {/* Submit Button */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate(-1)}
                  disabled={isSubmitting}
                  className="text-xs rounded-[8px] h-11 px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="secondary"
                  onClick={() => setSaveAs('draft')}
                  isLoading={isSubmitting && saveAs === 'draft'}
                  disabled={isSubmitting}
                  className="rounded-[8px] text-sm font-semibold px-4 h-11"
                >
                  Save draft
                </Button>
                <Button
                  type="submit"
                  onClick={() => setSaveAs('published')}
                  isLoading={isSubmitting && saveAs === 'published'}
                  disabled={isSubmitting}
                  className="rounded-[8px] text-sm font-semibold px-6 h-11"
                >
                  Publish idea
                </Button>
              </div>
            </form>
          </div>

          {/* Desktop Live Row Preview Column */}
          <div className="hidden lg:block lg:col-span-5 sticky top-24">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-muted flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent-strong" /> Live Row Preview
                </span>
                <span className="text-[11px] text-ink-faint">Updates as you type</span>
              </div>

              <div className="p-4 rounded-[12px] border border-dashed border-border bg-surface-muted">
                <IdeaRow idea={previewIdea} showRank={false} />
              </div>

              <div className="p-3.5 rounded-[10px] border border-border bg-surface text-xs text-ink-muted leading-relaxed">
                <p className="font-semibold text-ink mb-1">Ranked-list hero standard</p>
                Your proposal appears as a crisp ranked row with your initials tile, 56x56 review boxes, and one-click rating popover.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
