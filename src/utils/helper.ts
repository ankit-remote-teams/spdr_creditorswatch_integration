export function chunkArray<T>(array: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        result.push(array.slice(i, i + size));
    }
    return result;
}

export const get25HoursAgoDate = (): string => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    return twentyFourHoursAgo.toUTCString();
};
