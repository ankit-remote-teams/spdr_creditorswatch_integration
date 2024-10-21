import { SimproCustomerPaymentsType, SimproInvoiceType } from "../types/types";

export const simproInvoiceData: SimproInvoiceType[] = [
    {
        ID: 72769,
        Customer: {
            ID: 1601,
            CompanyName: "Elite New Homes ",
            GivenName: "",
            FamilyName: ""
        },
        Status: {
            ID: 21,
            Name: "Invoices : 91+ days overdue"
        },
        IsPaid: false,
        Stage: "Approved",
        Type: "ProgressInvoice",
        Total: {
            ExTax: 18404.18,
            IncTax: 20244.59,
            Tax: 1840.41,
            ReverseChargeTax: 0,
            AmountApplied: 20244.59,
            BalanceDue: 0,
        },
        DateIssued: "2024-02-29",
        DatePaid: "",
        DateCreated: "2024-02-29T09:58:17+11:00",
        LatePaymentFee: true,
        PaymentTerms: {
            Days: 14,
            Type: "Invoice",
            DueDate: "2024-03-14"
        },
    },
    {
        ID: 81902,
        Customer: {
            ID: 2492,
            CompanyName: "Enable Group Pty Ltd ",
            GivenName: "",
            FamilyName: ""
        },
        Status: {
            ID: 19,
            Name: "Invoices : 31-60 days overdue"
        },
        Stage: "Approved",
        Type: "ProgressInvoice",
        Total: {
            ExTax: 31274.67,
            IncTax: 34402.14,
            Tax: 3127.47,
            ReverseChargeTax: 0,
            AmountApplied: 14402.14,
            BalanceDue: 20000
        },
        IsPaid: false,
        DateIssued: "2024-08-31",
        DatePaid: "",
        DateCreated: "2024-08-30T05:27:20+10:00",
        LatePaymentFee: true,
        PaymentTerms: {
            Days: 14,
            Type: "Invoice",
            DueDate: "2024-09-14"
        }
    },
    {
        ID: 81907,
        Customer: {
            ID: 2183,
            CompanyName: "Mann Construction & Development Pty Ltd T/As Morewell Homes",
            GivenName: "",
            FamilyName: ""
        },
        Status: {
            ID: 19,
            Name: "Invoices : 31-60 days overdue"
        },
        Stage: "Approved",
        Type: "ProgressInvoice",
        Total: {
            ExTax: 602,
            IncTax: 662.2,
            Tax: 60.2,
            ReverseChargeTax: 0,
            AmountApplied: 275,
            BalanceDue: 387.2
        },
        IsPaid: false,
        DateIssued: "2024-08-30",
        DatePaid: "",
        DateCreated: "2024-08-30T05:37:19+10:00",
        LatePaymentFee: true,
        PaymentTerms: {
            Days: 14,
            Type: "Invoice",
            DueDate: "2024-09-13"
        }
    }
]


export const simproCustomerPaymentData: SimproCustomerPaymentsType[] = [
    {
        ID: 2114,
        Payment: {
            PaymentMethod: {
                ID: 77,
                Name: "CBA - ATC"
            },
            Status: "",
            DepositAccount: "1-1108",
            Date: "2024-08-12",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 74076,
                    Customer: {
                        ID: 1601,
                        CompanyName: "Elite New Homes ",
                        GivenName: "",
                        FamilyName: ""
                    },
                },
                Amount: 3770.8
            },
            {
                Invoice: {
                    ID: 73397,
                    Customer: {
                        ID: 1601,
                        CompanyName: "Elite New Homes ",
                        GivenName: "",
                        FamilyName: ""
                    },
                },
                Amount: 2530.57
            },
            {
                Invoice: {
                    ID: 72769,
                    Customer: {
                        ID: 1601,
                        CompanyName: "Elite New Homes ",
                        GivenName: "",
                        FamilyName: ""
                    },
                },
                "Amount": 1244.59
            }
        ]
    },
    {
        ID: 20616,
        Payment: {
            PaymentMethod: {
                ID: 103,
                Name: "CBA - SPDR Grp"
            },
            Status: "",
            DepositAccount: "1-1106",
            Date: "2024-07-01",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 72769,
                    Customer: {
                        ID: 1601,
                        CompanyName: "Elite New Homes ",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 13141,
                            Site: {
                                ID: 11561,
                                Name: "60 Murray Street, Fawkner"
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 28886.22,
                                IncTax: 31774.84
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 5000
            }
        ]
    },
    {
        ID: 20408,
        Payment: {
            PaymentMethod: {
                ID: 77,
                Name: "CBA - ATC"
            },
            Status: "",
            DepositAccount: "1-1103",
            Date: "2024-06-21",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 72769,
                    Customer: {
                        ID: 1601,
                        CompanyName: "Elite New Homes ",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 13141,
                            Site: {
                                ID: 11561,
                                Name: "60 Murray Street, Fawkner"
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 28886.22,
                                IncTax: 31774.84
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 5000
            }
        ]
    },
    {
        ID: 20159,
        Payment: {
            PaymentMethod: {
                ID: 77,
                Name: "CBA - ATC"
            },
            Status: "",
            DepositAccount: "1-1103",
            Date: "2024-06-05",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 72769,
                    Customer: {
                        ID: 1601,
                        CompanyName: "Elite New Homes ",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 13141,
                            Site: {
                                ID: 11561,
                                Name: "60 Murray Street, Fawkner"
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 28886.22,
                                IncTax: 31774.84
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 4000
            }
        ]
    },
    {
        ID: 19625,
        Payment: {
            PaymentMethod: {
                ID: 77,
                Name: "CBA - ATC"
            },
            Status: "",
            DepositAccount: "1-1103",
            Date: "2024-05-06",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 72769,
                    Customer: {
                        ID: 1601,
                        CompanyName: "Elite New Homes ",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 13141,
                            Site: {
                                ID: 11561,
                                Name: "60 Murray Street, Fawkner"
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 28886.22,
                                IncTax: 31774.84
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 5000
            }
        ]
    },
    {
        ID: 21576,
        Payment: {
            PaymentMethod: {
                ID: 103,
                Name: "CBA - SPDR Grp"
            },
            Status: "",
            DepositAccount: "1-1106",
            Date: "2024-09-12",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 81902,
                    Customer: {
                        ID: 2492,
                        CompanyName: "Enable Group Pty Ltd ",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 13923,
                            Site: {
                                ID: 14347,
                                Name: "47 Dent Street, Glen Iris "
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 50796.44,
                                IncTax: 55876.09
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 14402.14
            }
        ]
    },
    {
        ID: 21963,
        Payment: {
            PaymentMethod: {
                ID: 103,
                Name: "CBA - SPDR Grp"
            },
            Status: "",
            DepositAccount: "1-1106",
            Date: "2024-08-30",
            FinanceCharge: 0,
            CheckNo: "",
            Details: "",
        },
        Invoices: [
            {
                Invoice: {
                    ID: 81907,
                    Customer: {
                        ID: 2183,
                        CompanyName: "Mann Construction & Development Pty Ltd T/As Morewell Homes",
                        GivenName: "",
                        FamilyName: ""
                    },
                    Jobs: [
                        {
                            ID: 13967,
                            Site: {
                                ID: 16595,
                                Name: "Lot 20645 No 15 Mound Avenue, Donnybrook "
                            },
                            Comment: "",
                            Description: "",
                            Total: {
                                ExTax: 602,
                                IncTax: 662.2
                            }
                        }
                    ],
                    Currency: {
                        ID: "AUD",
                        Name: "Australian Dollar"
                    }
                },
                Amount: 275
            }
        ]
    }
]