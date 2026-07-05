import {defineField, defineType} from 'sanity'

export const post = defineType({
  name: 'post',
  title: 'Blog post',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description:
        'Becomes the page address: /blog/<slug>.html. Click "Generate" to derive it from the title. Do not change it after publishing — the old address would break.',
      options: {source: 'title', maxLength: 96},
      validation: (rule) =>
        rule.required().custom((value) => {
          if (value?.current && /[^a-z0-9-]/.test(value.current)) {
            return 'Use only lowercase letters, numbers, and hyphens'
          }
          return true
        }),
    }),
    defineField({
      name: 'publishedAt',
      title: 'Publish date',
      type: 'date',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      rows: 3,
      description:
        'One or two sentences summarizing the post. Shown on the blog index, in Google results, and in link previews. Aim for under 160 characters.',
      validation: (rule) => [
        rule.required(),
        rule.max(160).warning('Descriptions over 160 characters get cut off in Google results'),
      ],
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [
        {type: 'block'},
        {
          type: 'image',
          fields: [
            defineField({
              name: 'alt',
              title: 'Alternative text',
              type: 'string',
              description: 'Describes the image for screen readers and search engines',
            }),
          ],
        },
      ],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'coverImage',
      title: 'Cover image (optional)',
      type: 'image',
      fields: [
        defineField({
          name: 'alt',
          title: 'Alternative text',
          type: 'string',
        }),
      ],
    }),
  ],
  orderings: [
    {
      title: 'Publish date (newest first)',
      name: 'publishedAtDesc',
      by: [{field: 'publishedAt', direction: 'desc'}],
    },
  ],
  preview: {
    select: {title: 'title', subtitle: 'publishedAt', media: 'coverImage'},
  },
})
