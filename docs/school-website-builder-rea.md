# Wix editor research for the school website studio

The school editor follows the section-and-element workflow described in Wix's public editor guides. REA used a fresh headless Edge session without a Wix account. The observations below concern public pages and documentation. The authenticated editor, Wix source code, private APIs, and publishing infrastructure were outside the observation.

| Evidence | Observed behaviour | School implementation |
| --- | --- | --- |
| REA `ev_12ba23796c1028e42df0a86007471659cf03815f7c445e6b983b659b1f85c039` | The [Wix homepage](https://www.wix.com/) loaded and a heading became visible. The homepage links to its builder and template catalogue. | The school workspace has a visual editor at **Public website**. |
| REA `ev_e3d24260cc4a99255db911c331603ede05633a404abcccc3613b5e637a9822fe` | The accessibility tree of the [sections guide](https://support.wix.com/en/article/wix-editor-adding-and-setting-up-sections) describes inserting blank or predesigned sections, arranging them, and identifying them through layers. | Admins can use school-specific page starters, insert section templates, rearrange sections, and compose their own grid of elements. |
| [Animation guide](https://support.wix.com/en/article/wix-editor-adding-and-customizing-an-animation) | Wix documents entrance, scroll, loop, and pointer effects. | The school editor implements fade, rise, and zoom entrances when a section comes into view. The visitor's reduced-motion setting takes precedence. |
| [Preview and publishing guide](https://support.wix.com/en/article/wix-editor-saving-previewing-and-publishing-your-site) and [mobile editor guide](https://support.wix.com/en/article/wix-editor-about-the-mobile-editor) | Wix describes previewing unpublished changes, publishing explicitly, and tailoring visibility for mobile visitors. | Desktop and phone previews share the public renderer. Drafts are stored in the administrator's current browser. Publishing goes through the existing authorized school workspace save. |

The school studio uses responsive rows with full-, half-, and third-width elements. This layout choice preserves reading order and stacks columns on phones. Image uploads reuse the school's optimized image storage. Page URLs, the LMS link, existing school content, and per-field typography continue to use the school's data model.
