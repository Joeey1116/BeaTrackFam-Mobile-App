/**
 * Reviews — Judge.me product reviews section for the product detail screen.
 *
 * Rendered only when isReviewsConfigured() is true; otherwise the product
 * screen omits it entirely (no dead UI). Theme-aware, brand colors
 * (black / white / light gray) via the shared theme tokens.
 */
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "./ThemeProvider";
import { EmptyState, PrimaryButton, SectionLabel, TextField } from "./ui";
import { Radius, Spacing } from "../constants/theme";
import {
  fetchReviews,
  isReviewsConfigured,
  submitReview,
  type ProductReview,
  type ReviewsPage,
} from "../lib/reviews";

const PAGE_SIZE = 5;

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StarRow({
  value,
  size = 16,
  onRate,
}: {
  value: number;
  size?: number;
  onRate?: (stars: number) => void;
}) {
  const { colors } = useTheme();
  const filled = Math.round(value);
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((s) => {
        const star = (
          <Ionicons
            name={s <= filled ? "star" : "star-outline"}
            size={size}
            color={s <= filled ? "#F5A623" : colors.textDim}
          />
        );
        return onRate ? (
          <Pressable
            key={s}
            onPress={() => onRate(s)}
            hitSlop={8}
            accessibilityLabel={`Rate ${s} star${s > 1 ? "s" : ""}`}
          >
            {star}
          </Pressable>
        ) : (
          <View key={s}>{star}</View>
        );
      })}
    </View>
  );
}

function ReviewCard({ review }: { review: ProductReview }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.cardHeader}>
        <StarRow value={review.rating} size={14} />
        {review.verified && (
          <View style={[styles.verifiedBadge, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
            <Ionicons name="checkmark-circle" size={13} color={colors.success} />
            <Text style={[styles.verifiedText, { color: colors.textMuted }]}>
              Verified purchase
            </Text>
          </View>
        )}
      </View>
      {review.title.length > 0 && (
        <Text style={[styles.reviewTitle, { color: colors.text }]}>
          {review.title}
        </Text>
      )}
      <Text style={[styles.reviewBody, { color: colors.textMuted }]}>
        {review.body}
      </Text>
      <Text style={[styles.reviewMeta, { color: colors.textDim }]}>
        {review.reviewerName}
        {formatDate(review.createdAt) ? ` · ${formatDate(review.createdAt)}` : ""}
      </Text>
    </View>
  );
}

function RatingSummary({ page }: { page: ReviewsPage }) {
  const { colors } = useTheme();
  const { average, count, distribution } = page.summary;
  const maxBucket = Math.max(1, ...[5, 4, 3, 2, 1].map((s) => distribution[String(s)] ?? 0));
  return (
    <View style={[styles.summary, { backgroundColor: colors.surface }]}>
      <View style={styles.summaryLeft}>
        <Text style={[styles.average, { color: colors.text }]}>
          {average.toFixed(1)}
        </Text>
        <StarRow value={average} size={18} />
        <Text style={[styles.count, { color: colors.textMuted }]}>
          {count} review{count === 1 ? "" : "s"}
        </Text>
      </View>
      <View style={styles.summaryBars}>
        {[5, 4, 3, 2, 1].map((s) => {
          const n = distribution[String(s)] ?? 0;
          return (
            <View key={s} style={styles.barRow}>
              <Text style={[styles.barLabel, { color: colors.textMuted }]}>
                {s}★
              </Text>
              <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.round((n / maxBucket) * 100)}%`, backgroundColor: colors.text },
                  ]}
                />
              </View>
              <Text style={[styles.barCount, { color: colors.textDim }]}>{n}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function Reviews({
  productNumericId,
  productTitle,
}: {
  productNumericId: string;
  productTitle: string;
}) {
  const { colors } = useTheme();
  const [data, setData] = useState<ReviewsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const result = await fetchReviews(productNumericId, pageNum, PAGE_SIZE);
        setData((prev) =>
          append && prev
            ? { ...result, reviews: [...prev.reviews, ...result.reviews] }
            : result
        );
      } catch (e) {
        if (!append) {
          setError(e instanceof Error ? e.message : "Couldn't load reviews.");
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [productNumericId]
  );

  // Initial load. The async body only touches state after an await (the
  // codebase's accepted pattern, e.g. store/shop.tsx) so nothing is set
  // synchronously inside the effect.
  useEffect(() => {
    if (!isReviewsConfigured()) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await fetchReviews(productNumericId, 1, PAGE_SIZE);
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Couldn't load reviews."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productNumericId]);

  const onSubmit = async () => {
    setFormError(null);
    if (name.trim().length === 0) {
      setFormError("Enter your name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setFormError("Enter a valid email address.");
      return;
    }
    if (body.trim().length === 0) {
      setFormError("Write your review.");
      return;
    }
    setSubmitting(true);
    try {
      await submitReview({
        productId: productNumericId,
        name: name.trim(),
        email: email.trim(),
        rating,
        title: title.trim(),
        body: body.trim(),
      });
      setSubmitted(true);
      setFormOpen(false);
      setName("");
      setEmail("");
      setRating(5);
      setTitle("");
      setBody("");
      // Refresh — the review appears once Judge.me publishes it.
      load(1, false);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't submit the review.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isReviewsConfigured()) return null;

  return (
    <View style={styles.wrap}>
      <SectionLabel text="REVIEWS" />

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.text} />
      ) : error ? (
        <View style={styles.errorWrap}>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>
            {error}
          </Text>
          <Pressable onPress={() => load(1, false)} hitSlop={10}>
            <Text style={[styles.retry, { color: colors.text }]}>Try again</Text>
          </Pressable>
        </View>
      ) : data && data.summary.count > 0 ? (
        <>
          <RatingSummary page={data} />
          {data.reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
          {data.hasMore && (
            <Pressable
              onPress={() => load(data.page + 1, true)}
              disabled={loadingMore}
              style={[styles.loadMore, { borderColor: colors.border }]}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Text style={[styles.loadMoreText, { color: colors.text }]}>
                  Load more reviews
                </Text>
              )}
            </Pressable>
          )}
        </>
      ) : (
        <EmptyState
          icon={<Ionicons name="chatbubbles-outline" size={40} color={colors.textDim} />}
          title="No reviews yet"
          subtitle={`Be the first to review the ${productTitle}!`}
        />
      )}

      {submitted && (
        <View style={[styles.thanks, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text style={[styles.thanksText, { color: colors.text }]}>
            Thanks! Your review was submitted.
          </Text>
        </View>
      )}

      {!formOpen ? (
        <Pressable
          onPress={() => {
            setFormOpen(true);
            setSubmitted(false);
          }}
          style={[styles.writeButton, { borderColor: colors.border }]}
        >
          <Ionicons name="pencil-outline" size={18} color={colors.text} />
          <Text style={[styles.writeButtonText, { color: colors.text }]}>
            Write a review
          </Text>
        </Pressable>
      ) : (
        <View style={[styles.form, { backgroundColor: colors.surface }]}>
          <Text style={[styles.formTitle, { color: colors.text }]}>
            Your review
          </Text>
          <Text style={[styles.formLabel, { color: colors.text }]}>
            Rating
          </Text>
          <StarRow value={rating} size={32} onRate={setRating} />
          <View style={styles.fieldGap} />
          <TextField
            label="Name"
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
          <TextField
            label="Email"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <TextField
            label="Headline (optional)"
            placeholder="Sum it up in a few words"
            value={title}
            onChangeText={setTitle}
          />
          <Text style={[styles.formLabel, { color: colors.text }]}>
            Review
          </Text>
          <TextInput
            style={[
              styles.bodyInput,
              {
                backgroundColor: colors.input,
                color: colors.text,
              },
            ]}
            placeholder="What did you think?"
            placeholderTextColor={colors.textDim}
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          {formError && (
            <Text style={[styles.formError, { color: colors.danger }]}>
              {formError}
            </Text>
          )}
          <View style={styles.formButtons}>
            <View style={styles.formButtonFlex}>
              <PrimaryButton
                label={submitting ? "Submitting…" : "Submit review"}
                onPress={onSubmit}
                disabled={submitting}
              />
            </View>
          </View>
          <Pressable
            onPress={() => {
              setFormOpen(false);
              setFormError(null);
            }}
            hitSlop={10}
            style={styles.cancelWrap}
          >
            <Text style={[styles.cancel, { color: colors.textMuted }]}>
              Cancel
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: Spacing.sm },
  loader: { paddingVertical: Spacing.xl },
  starRow: { flexDirection: "row", gap: 2, alignItems: "center" },
  summary: {
    flexDirection: "row",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  summaryLeft: { alignItems: "center", justifyContent: "center", gap: 4 },
  average: { fontSize: 36, fontWeight: "800" },
  count: { fontSize: 12 },
  summaryBars: { flex: 1, justifyContent: "center", gap: 5 },
  barRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  barLabel: { fontSize: 12, fontWeight: "700", width: 22 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },
  barCount: { fontSize: 12, width: 24, textAlign: "right" },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  verifiedText: { fontSize: 11, fontWeight: "600" },
  reviewTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  reviewBody: { fontSize: 14, lineHeight: 20 },
  reviewMeta: { fontSize: 12, marginTop: 8 },
  errorWrap: { alignItems: "center", paddingVertical: Spacing.lg, gap: 8 },
  errorText: { fontSize: 14, textAlign: "center" },
  retry: { fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
  loadMore: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  loadMoreText: { fontSize: 14, fontWeight: "700" },
  thanks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  thanksText: { fontSize: 14, fontWeight: "600", flex: 1 },
  writeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: 13,
    marginTop: Spacing.md,
  },
  writeButtonText: { fontSize: 15, fontWeight: "700" },
  form: { borderRadius: Radius.lg, padding: Spacing.md, marginTop: Spacing.md },
  formTitle: { fontSize: 17, fontWeight: "800", marginBottom: Spacing.sm },
  formLabel: { fontSize: 14, fontWeight: "700", marginBottom: Spacing.xs },
  fieldGap: { height: Spacing.sm },
  bodyInput: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    minHeight: 100,
  },
  formError: { fontSize: 13, fontWeight: "600", marginTop: Spacing.sm },
  formButtons: { marginTop: Spacing.md },
  formButtonFlex: { flex: 1 },
  cancelWrap: { alignItems: "center", marginTop: Spacing.sm },
  cancel: { fontSize: 14, fontWeight: "600" },
});
