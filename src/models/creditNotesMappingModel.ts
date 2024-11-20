import { Schema, model } from 'mongoose';
import { IMapping } from '../types/creditorswatch.types';


// Define the Mongoose schema
const CreditNoteSchema = new Schema<IMapping>(
    {
        simproId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        creditorsWatchId: {
            type: String,
            required: true,
            unique: true,
        },
        lastSyncedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { timestamps: true }
);

// Create and export the Mongoose model
const CreditNoteMapping = model<IMapping>('CreditNoteMapping', CreditNoteSchema);

export default CreditNoteMapping;
