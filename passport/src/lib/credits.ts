/* Third-party attribution (doc 19). The Dylan avatar style is CC BY 4.0, which
   requires crediting the creator wherever the work is used. We read the credit
   straight from the style's own metadata so it can never drift from the installed
   version. Surfaced under the avatar editor. */

import * as dylan from "@dicebear/dylan";

export interface Credit {
  title: string;
  creator: string;
  license: string;
  licenseUrl: string;
  source: string;
}

export const AVATAR_CREDIT: Credit = {
  title: dylan.meta.title ?? "Dylan! The Avatar Generator",
  creator: dylan.meta.creator ?? "Natalia Spivak",
  license: dylan.meta.license?.name ?? "CC BY 4.0",
  licenseUrl:
    dylan.meta.license?.url ?? "https://creativecommons.org/licenses/by/4.0/",
  source: dylan.meta.source ?? "https://www.dicebear.com/styles/dylan/",
};
