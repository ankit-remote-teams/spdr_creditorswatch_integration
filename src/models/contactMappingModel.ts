import { Schema, model } from 'mongoose';
import { IMapping } from '../types/types';


// Define the Mongoose schema
const ContactSchema = new Schema<IMapping>(
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
const ContactMapping = model<IMapping>('ContactMapping', ContactSchema);

export default ContactMapping;
