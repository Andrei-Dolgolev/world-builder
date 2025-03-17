declare module 'formidable' {
    import { IncomingMessage } from 'http';

    export interface Fields {
        [key: string]: string | string[];
    }

    export interface Files {
        [key: string]: File | File[];
    }

    export interface File {
        filepath: string;
        originalFilename: string;
        mimetype: string;
        size: number;
        newFilename: string;
        [key: string]: any;
    }

    export interface Options {
        encoding?: string;
        uploadDir?: string;
        keepExtensions?: boolean;
        maxFieldsSize?: number;
        maxFields?: number;
        maxFileSize?: number;
        hash?: boolean;
        multiples?: boolean;
        [key: string]: any;
    }

    class IncomingForm {
        constructor(options?: Options);
        parse(req: IncomingMessage, callback: (err: any, fields: Fields, files: Files) => void): void;
        uploadDir: string;
        keepExtensions: boolean;
    }

    export default {
        IncomingForm
    };
} 