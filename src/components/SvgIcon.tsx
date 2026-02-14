
import type { CSSProperties, JSX } from "preact";
import { useMemo } from "preact/hooks";

export type SvgIconProps = Omit<JSX.IntrinsicElements["svg"], "style"> & {
    src: string;
    title?: string;
    /**
     * If true, replaces fill and stroke attributes with "currentColor" in the inner SVG content.
     * Default: true
     */
    stripColors?: boolean;
    style?: CSSProperties;
    // Explicitly add common props to ensure destructuring works smoothly
    className?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: string | number;
    width?: string | number;
    height?: string | number;
};

export function SvgIcon({
    src,
    width,
    height,
    title,
    stripColors = true,
    className,
    style,
    fill,
    stroke,
    strokeWidth,
    ...props
}: SvgIconProps) {
    const { viewBox, content } = useMemo(() => {
        if (!src) return { viewBox: "0 0 24 24", content: "" };

        const trimmedSrc = src.trim();
        // Extract viewBox
        const viewBoxMatch = trimmedSrc.match(/viewBox="([^"]*)"/);
        const viewBox = viewBoxMatch ? viewBoxMatch[1] : "0 0 24 24";

        // Extract inner content by removing the outer <svg> wrapper
        // We remove the opening <svg ...> tag and the closing </svg> tag only.
        let content = trimmedSrc.replace(/^<svg[^>]*>/i, "").replace(/<\/svg>\s*$/i, "");

        return { viewBox, content };
    }, [src]);

    const cleanContent = useMemo(() => {
        if (!content) return "";
        let nextContent = content;

        if (stripColors) {
            // Force inner nodes to use props instead of hardcoded SVG values.
            const fillValue = fill !== undefined ? fill : "none";
            const strokeValue = stroke !== undefined ? stroke : "currentColor";
            nextContent = nextContent
                .replace(/fill="[^"]*"/gi, `fill="${fillValue}"`)
                .replace(/stroke="[^"]*"/gi, `stroke="${strokeValue}"`);
        }

        if (strokeWidth !== undefined) {
            const strokeWidthValue = String(strokeWidth);
            nextContent = /stroke-width="[^"]*"/i.test(nextContent)
                ? nextContent.replace(/stroke-width="[^"]*"/gi, `stroke-width="${strokeWidthValue}"`)
                : nextContent.replace(
                    /<(path|circle|ellipse|line|polyline|polygon|rect)\b/gi,
                    `<$1 stroke-width="${strokeWidthValue}"`,
                );
        }

        return nextContent;
    }, [content, stripColors, fill, stroke, strokeWidth]);

    return (
        <svg
            viewBox={viewBox}
            width={width}
            height={height}
            className={className}
            style={{
                display: "inline-block",
                verticalAlign: "middle",
                flexShrink: 0,
                ...style,
            }}
            xmlns="http://www.w3.org/2000/svg"
            {...props}
            dangerouslySetInnerHTML={{ __html: cleanContent }}
        >
            {title && <title>{title}</title>}
        </svg>
    );
}
