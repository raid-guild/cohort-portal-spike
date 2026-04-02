import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { supabaseAdminClient } from "@/lib/supabase/admin";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileIdentity } from "@/components/profile/ProfileIdentity";
import { DaoBlogMarkdown } from "@/modules/dao-blog/DaoBlogMarkdown";
import { DaoBlogReferralForm } from "@/modules/dao-blog/DaoBlogReferralForm";

type Post = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  header_image_url: string;
  body_md: string;
  external_author_name: string | null;
  external_author_avatar_url: string | null;
  published_at: string | null;
  author_user_id: string;
  author: {
    user_id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

function getSiteOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

async function loadPublishedPost(slug: string): Promise<Post | null> {
  const admin = supabaseAdminClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            is: (column: string, value: null) => {
              maybeSingle: () => Promise<{ data: unknown; error: { message: string } | null }>;
            };
          };
        };
      };
    };
  };

  const { data, error } = await admin
    .from("dao_blog_posts")
    .select(
      "id,title,slug,summary,header_image_url,body_md,external_author_name,external_author_avatar_url,published_at,author_user_id",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const post = (data as Omit<Post, "author"> | null) ?? null;
  if (!post) {
    return null;
  }

  const { data: author } = await supabaseAdminClient()
    .from("profiles")
    .select("user_id,handle,display_name,avatar_url")
    .eq("user_id", post.author_user_id)
    .maybeSingle();

  return {
    ...post,
    author: (author as Post["author"]) ?? null,
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await loadPublishedPost(slug);

  if (!post) {
    return {
      title: "Post Not Found",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  const siteOrigin = getSiteOrigin();
  const permalink = `${siteOrigin}/modules/dao-blog/${post.slug}`;

  return {
    title: post.title,
    description: post.summary,
    alternates: {
      canonical: permalink,
    },
    openGraph: {
      title: post.title,
      description: post.summary,
      url: permalink,
      type: "article",
      images: [
        {
          url: post.header_image_url,
        },
      ],
      publishedTime: post.published_at ?? undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.summary,
      images: [post.header_image_url],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function DaoBlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await loadPublishedPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Image
        src={post.header_image_url}
        alt={post.title}
        width={1200}
        height={630}
        className="h-auto w-full rounded-xl border border-border"
      />
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {post.published_at ? new Date(post.published_at).toLocaleDateString("en-US") : "Published"}
        </p>
        <h1 className="text-4xl font-semibold leading-tight">{post.title}</h1>
        <p className="text-sm text-muted-foreground">{post.summary}</p>
        {post.external_author_name ? (
          <div className="flex items-center gap-3">
            <ProfileAvatar
              name={post.external_author_name}
              url={post.external_author_avatar_url}
              size={32}
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold">{post.external_author_name}</div>
            </div>
          </div>
        ) : post.author ? (
          <a href={`/people/${post.author.handle}`} className="inline-block">
            <ProfileIdentity
              handle={post.author.handle}
              displayName={post.author.display_name || post.author.handle}
              avatarUrl={post.author.avatar_url}
              avatarSize={32}
              compact
            />
          </a>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <DaoBlogMarkdown markdown={post.body_md} />
      </div>

      <DaoBlogReferralForm slug={post.slug} />
    </article>
  );
}
