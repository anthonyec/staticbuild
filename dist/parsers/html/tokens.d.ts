declare type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
declare type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
declare enum HTMLTokenType {
    DocType = 0,
    StartTag = 1,
    EndTag = 2,
    Comment = 3,
    Character = 4,
    EndOfFile = 5
}
declare type Attributes = Record<string, string | number | boolean>;
interface DocTypeToken {
    type: HTMLTokenType.DocType;
    name: string;
    publicIdentifier: string;
    systemPublicIdentifier: string;
    forceQuirks: boolean;
}
interface TagToken {
    type: HTMLTokenType.StartTag | HTMLTokenType.EndTag;
    tagName: string;
    selfClosing: boolean;
    attributes: Attributes;
}
interface CommentToken {
    type: HTMLTokenType.Comment;
    data: string;
}
interface CharacterToken {
    type: HTMLTokenType.Character;
    data: string;
}
interface EndOfFileToken {
}
export declare type HTMLToken = DocTypeToken | TagToken | CommentToken | CharacterToken | EndOfFileToken;
export declare function createDocTypeToken(properties: Omit<WithOptional<DocTypeToken, 'forceQuirks'>, 'type'>): DocTypeToken;
export declare function createTagToken(type: 'start' | 'end', properties: Omit<WithOptional<TagToken, 'selfClosing' | 'attributes'>, 'type'>): TagToken;
export declare function createCommentToken(data: string): CommentToken;
export declare function createCharacterToken(data: string): CharacterToken;
export declare function createEndOfFileToken(): EndOfFileToken;
export {};
